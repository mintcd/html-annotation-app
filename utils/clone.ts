/* eslint-disable @typescript-eslint/no-explicit-any */
import { cache } from 'react';
import * as cheerio from 'cheerio';
import * as css from 'css';
import { originToSlug } from './url';

export type ClonedPage = {
  title: string;
  favicon?: string;
  body: string;
  scripts?: Array<{
    id?: string;
    src?: string;
    content?: string;
    type?: string;
    async?: boolean;
    defer?: boolean;
    location?: 'head' | 'body';
  }>;
};

function isSkippable(u: string) {
  return /^data:|^blob:|^mailto:|^tel:|^javascript:/i.test(u || "");
}

function absoluteUrl(base: string, relative: string): string {
  if (!relative) return '';
  if (/^data:|^blob:|^mailto:|^tel:|^javascript:/i.test(relative)) return relative;
  try {
    return new URL(relative, base).href;
  } catch (e) {
    try {
      const dir = new URL('.', base).href;
      return new URL(relative, dir).href;
    } catch (err) {
      return relative;
    }
  }
}

function isJsonOnly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Check if it's a JSON object or array
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function injectSignalSnippet(text: string, url: string, signalId?: string, scriptType?: string): string {
  // Skip injection for JSON data scripts or non-executable script types
  if (scriptType && scriptType !== 'text/javascript' && scriptType !== 'module' && !scriptType.includes('javascript')) {
    return text;
  }

  // Skip injection if content is pure JSON
  if (isJsonOnly(text)) {
    return text;
  }

  const payload = signalId ? { id: signalId } : { url };
  const signalSnippet = `\n\n;// Proxy execution signal - do not remove\n(function(){try{var d=${JSON.stringify(payload)};if(typeof window!=='undefined'){window.__proxy_script_executed=window.__proxy_script_executed||[];window.__proxy_script_executed.push(d.id||d.url);if(typeof window.__proxy_script_executed_dispatch!=='function'){window.__proxy_script_executed_dispatch=function(detail){try{var ev;try{ev=new CustomEvent('proxy:script-executed',{detail:detail});}catch(e){ev=document.createEvent('CustomEvent');ev.initCustomEvent('proxy:script-executed',false,false,detail);}if(typeof window!=='undefined'&&window.dispatchEvent){window.dispatchEvent(ev);} }catch(e){if(typeof console!=='undefined'&&console.warn)console.warn('proxy dispatch error',e);}}}try{window.__proxy_script_executed_dispatch(d);}catch(e){} } }catch(err){if(typeof console!=='undefined'&&console.warn)console.warn('proxy signal error',err);} })();\n`;
  return `${text}\n${signalSnippet}`;
}

function rewriteCss(cssText: string, cssUrl: string, proxiedUrl: (url: string) => string) {
  cssText = cssText.replace(/url\((['"]?)([^'"\)]+)\1\)/g, (match, quote, url) => {
    if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return match;
    try {
      return `url(${quote}${proxiedUrl(new URL(url, cssUrl).href)}${quote})`;
    } catch { return match; }
  });

  cssText = cssText.replace(/@import\s+url\((['"]?)([^'"\)]+)\1\)/g, (match, quote, url) => {
    if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return match;
    try {
      return `@import url(${quote}${proxiedUrl(new URL(url, cssUrl).href)}${quote})`;
    } catch { return match; }
  });

  cssText = cssText.replace(/@import\s+(['"])([^'";\)]+)\1\s*;/g, (match, quote, url) => {
    if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return match;
    try {
      return `@import url(${quote}${proxiedUrl(new URL(url, cssUrl).href)}${quote})`;
    } catch { return match; }
  });

  return cssText;
}

export const getClonedPage = cache(async (url: string): Promise<ClonedPage> => {
  if (!url) throw new Error('Missing URL');

  const fetchHeaders: Record<string, string> = {
    'User-Agent': 'Chrome/120.0.0.0',
    'Content-Type': 'text/html',
  };

  const res = await fetch(url, { redirect: 'follow', headers: fetchHeaders });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const pageUrl = new URL(res.url);
  const baseTagHref = $('base[href]').attr('href');
  const clonedBase = (baseTagHref ? new URL(baseTagHref, pageUrl) : new URL('.', pageUrl)).href;

  // ── Origin registration ───────────────────────────────────────────────────
  // Website registration happens in the browser through the generated db.
  // The clone pipeline only needs deterministic slugs for rewritten URLs.
  const slugMap = new Map<string, string>();
  slugMap.set(pageUrl.origin, originToSlug(pageUrl.origin));

  $('[src],[href]').each((_, el) => {
    const raw = ($(el).attr('src') || $(el).attr('href') || '').trim();
    if (!raw || isSkippable(raw)) return;
    try {
      const origin = new URL(absoluteUrl(clonedBase, raw)).origin;
      if (!slugMap.has(origin)) {
        slugMap.set(origin, originToSlug(origin));
      }
    } catch { /* ignore */ }
  });

  // Slug-aware proxy URL builder — used everywhere below.
  // Assets go to /proxy/{slug}{pathname} so they never collide with the
  // [site]/[[...path]] page route. No middleware needed.
  function proxiedUrl(targetUrl: string): string {
    try {
      const u = new URL(targetUrl);
      const slug = slugMap.get(u.origin) ?? originToSlug(u.origin);
      return `/proxy/${slug}${u.pathname}${u.search}${u.hash}`;
    } catch {
      return targetUrl;
    }
  }

  // Remove cookie/consent banners and unneeded link hints
  $('[class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"], [class*="gdpr"], [id*="gdpr"]').remove();

  // Handle resource hint links carefully:
  //
  //  rel="preload" as="style"  → many sites use this as an async-CSS loader:
  //    <link rel="preload" as="style" onload="this.rel='stylesheet'" href="…">
  //    We strip the hint attributes and promote it to a real stylesheet so
  //    the CSS actually applies.  The href gets proxied in the stylesheet loop.
  //
  //  rel="preload" as="font"   → keep with proxied href so fonts load.
  //
  //  rel="preload" (no/invalid as)  → strip; React warns about these.
  //
  //  prefetch / preconnect / dns-prefetch / modulepreload
  //    → strip; they are pure performance hints with no effect in a clone.
  $('link[rel~="preload"]').each((_, el) => {
    const asVal = ($(el).attr('as') || '').toLowerCase();
    const href = $(el).attr('href');
    if (asVal === 'style' && href) {
      // Promote to stylesheet — the stylesheet loop below will proxy the href.
      $(el).attr('rel', 'stylesheet');
      $(el).removeAttr('as');
      $(el).removeAttr('onload');
      $(el).removeAttr('onerror');
    } else if (asVal === 'font' && href) {
      try { $(el).attr('href', proxiedUrl(absoluteUrl(clonedBase, href))); } catch { }
    } else {
      $(el).remove();
    }
  });
  $('link[rel~="prefetch"], link[rel~="modulepreload"], link[rel~="preconnect"], link[rel~="dns-prefetch"]').remove();

  // Rewrite anchors
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    if (/^(#|mailto:|tel:|javascript:)/i.test(href)) return;
    $(el).attr('href', absoluteUrl(clonedBase, href));
  });

  // Images
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src') as string;
    $(el).attr('src', absoluteUrl(clonedBase, src));
  });

  // srcset
  $('img[srcset], source[srcset]').each((_, el) => {
    const srcset = $(el).attr('srcset');
    if (!srcset) return;
    const rewritten = srcset
      .split(',')
      .map(part => {
        const [u, d] = part.trim().split(/\s+/, 2);
        if (!u || isSkippable(u)) return part;
        const abs = absoluteUrl(clonedBase, u);
        return d ? `${abs} ${d}` : abs;
      })
      .join(', ');
    $(el).attr('srcset', rewritten);
  });

  // Extract scripts into a serializable array so the client can inject them
  const scripts: Array<{ id?: string; src?: string; content?: string; type?: string; async?: boolean; defer?: boolean; location?: 'head' | 'body' }> = [];

  // Domains whose scripts make back-channel authenticated API calls that
  // always fail through a proxy (cookie consent SDKs, tag managers, etc.).
  const BLOCKED_SCRIPT_DOMAINS = [
    // Cookie / consent SDKs
    'cdn.cookielaw.org',
    'cdn.onetrust.com',
    'onetrust.com',
    'cookiebot.com',
    'usercentrics.eu',
    'trustarc.com',
    'cookiepro.com',
    'consent.cookiefirst.com',
    // Tag managers & analytics (require own domain + HTTPS)
    'googletagmanager.com',
    'google-analytics.com',
    'analytics.google.com',
    'hotjar.com',
    'static.hotjar.com',
    'script.hotjar.com',
    // Ad / tracking pixels
    'doubleclick.net',
    'googlesyndication.com',
    'adservice.google.com',
    'connect.facebook.net',
    'sc-static.net',
  ];
  function isBlockedScript(src: string): boolean {
    try { return BLOCKED_SCRIPT_DOMAINS.some(d => new URL(src).hostname.endsWith(d)); } catch { return false; }
  }

  // Process head scripts first and remove them
  $('head script').each((_, el) => {
    const script = $(el);
    const src = script.attr('src');
    const content = (script.text() || '').trim();
    const type = script.attr('type') || undefined;
    const async = script.attr('async') !== undefined;
    const defer = script.attr('defer') !== undefined;

    if (src) {
      const abs = absoluteUrl(clonedBase, src);
      if (isBlockedScript(abs)) { script.remove(); return; }
      const proxied = proxiedUrl(abs);
      const scriptId = `${url}#script-${scripts.length}`;
      scripts.push({ id: scriptId, src: proxied, type, async, defer, location: 'head' });
    } else if (content) {
      let rewrittenContent = content;
      rewrittenContent = rewrittenContent.replace(/(?:[\"']?)src(?:[\"']?)\s*:\s*("|')(.*?)\1/g, (m: any, q: any, u: any) => {
        if (!u || u.startsWith('http') || u.startsWith('//') || isSkippable(u) || u.includes('/proxy/')) return m;
        return `src: ${q}${proxiedUrl(absoluteUrl(clonedBase, u))}${q}`;
      });
      rewrittenContent = rewrittenContent.replace(/\.src\s*=\s*("|')(.*?)\1/g, (m: any, q: any, u: any) => {
        if (!u || u.startsWith('http') || u.startsWith('//') || isSkippable(u) || u.includes('/proxy/')) return m;
        return m.replace(u, proxiedUrl(absoluteUrl(clonedBase, u)));
      });
      rewrittenContent = rewrittenContent.replace(/setAttribute\(\s*("|')src\1\s*,\s*("|')(.*?)\2\s*\)/g, (m: any, _q1: any, q2: any, u: any) => {
        if (!u || u.startsWith('http') || u.startsWith('//') || isSkippable(u) || u.includes('/proxy/')) return m;
        return m.replace(u, proxiedUrl(absoluteUrl(clonedBase, u)));
      });
      rewrittenContent = rewrittenContent.replace(/(\w+)\s*:\s*['"](\/[^'\"]*)['"]/g, (m: any, prop: any, u: any) => {
        if (prop === 'src' && !u.startsWith('http') && !u.startsWith('//') && !isSkippable(u) && !u.includes('/proxy/')) {
          return `${prop}: '${proxiedUrl(absoluteUrl(clonedBase, u))}'`;
        }
        return m;
      });

      const scriptId = `${url}#script-${scripts.length}`;
      const finalContent = injectSignalSnippet(rewrittenContent, url, scriptId, type);
      scripts.push({ id: scriptId, content: finalContent, type, async, defer, location: 'head' });
    }
  }).remove();

  // Process body scripts and remove them
  $('body script').each((_, el) => {
    const script = $(el);
    const src = script.attr('src');
    const content = (script.text() || '').trim();
    const type = script.attr('type') || undefined;
    const async = script.attr('async') !== undefined;
    const defer = script.attr('defer') !== undefined;

    if (src) {
      const abs = absoluteUrl(clonedBase, src);
      if (isBlockedScript(abs)) { script.remove(); return; }
      const proxied = proxiedUrl(abs);
      const scriptId = `${url}#script-${scripts.length}`;
      scripts.push({ id: scriptId, src: proxied, type, async, defer, location: 'body' });
    } else if (content) {
      let rewrittenContent = content;
      rewrittenContent = rewrittenContent.replace(/(?:[\"']?)src(?:[\"']?)\s*:\s*("|')(.*?)\1/g, (m: any, q: any, u: any) => {
        if (!u || u.startsWith('http') || u.startsWith('//') || isSkippable(u) || u.includes('/proxy/')) return m;
        return `src: ${q}${proxiedUrl(absoluteUrl(clonedBase, u))}${q}`;
      });
      rewrittenContent = rewrittenContent.replace(/\.src\s*=\s*("|')(.*?)\1/g, (m: any, q: any, u: any) => {
        if (!u || u.startsWith('http') || u.startsWith('//') || isSkippable(u) || u.includes('/proxy/')) return m;
        return m.replace(u, proxiedUrl(absoluteUrl(clonedBase, u)));
      });
      rewrittenContent = rewrittenContent.replace(/setAttribute\(\s*("|')src\1\s*,\s*("|')(.*?)\2\s*\)/g, (m: any, _q1: any, q2: any, u: any) => {
        if (!u || u.startsWith('http') || u.startsWith('//') || isSkippable(u) || u.includes('/proxy/')) return m;
        return m.replace(u, proxiedUrl(absoluteUrl(clonedBase, u)));
      });
      rewrittenContent = rewrittenContent.replace(/(\w+)\s*:\s*['"](\/[^'\"]*)['"]/g, (m: any, prop: any, u: any) => {
        if (prop === 'src' && !u.startsWith('http') && !u.startsWith('//') && !isSkippable(u) && !u.includes('/proxy/')) {
          return `${prop}: '${proxiedUrl(absoluteUrl(clonedBase, u))}'`;
        }
        return m;
      });

      const scriptId = `${url}#script-${scripts.length}`;
      const finalContent = injectSignalSnippet(rewrittenContent, url, scriptId, type);
      scripts.push({ id: scriptId, content: finalContent, type, async, defer, location: 'body' });
    }
    // remove the script from DOM so body HTML is script-free
    script.remove();
  });

  // Rewrite and hoist styles
  const headStyles: string[] = [];
  $('head style').each((_: any, el: any) => {
    let styleContent = $(el).html() || '';
    styleContent = styleContent.replace(/font-family\s*:\s*([^;]+);/gi, 'font-family: $1 !important;');
    try {
      const parsed = css.parse(styleContent);
      if (parsed.stylesheet) {
        parsed.stylesheet.rules.forEach((rule: any) => {
          if (rule.type === 'rule' && rule.selectors) {
            rule.selectors = rule.selectors.map((sel: any) => {
              let newSel = sel.replace(/\bbody\b/g, '.cloned-content');
              if (!newSel.includes('.cloned-content')) newSel = '.cloned-content ' + newSel;
              return newSel;
            });
          }
        });
        styleContent = css.stringify(parsed);
      }
    } catch (e) {
      styleContent = `.cloned-content { ${styleContent} }`;
    }
    try {
      styleContent = rewriteCss(styleContent, clonedBase, proxiedUrl);
    } catch { }
    headStyles.push(`<style>${styleContent}</style>`);
  }).remove();

  $('head link[rel="stylesheet"]').each((_: any, el: any) => {
    try {
      const href = $(el).attr('href');
      if (href) {
        try {
          const abs = absoluteUrl(clonedBase, href);
          $(el).attr('href', proxiedUrl(abs));
        } catch { }
      }
    } catch { }
    headStyles.push($.html(el));
  }).remove();

  const $body = $('body');

  // Prepend styles to body
  for (let i = headStyles.length - 1; i >= 0; i--) {
    $body.prepend(headStyles[i]);
  }

  $('body style').each((_: any, el: any) => {
    try {
      let styleContent = $(el).html() || '';
      try { styleContent = rewriteCss(styleContent, clonedBase, proxiedUrl); } catch { }
      try {
        const parsed = css.parse(styleContent);
        if (parsed.stylesheet) {
          parsed.stylesheet.rules.forEach((rule: any) => {
            if (rule.type === 'rule' && rule.selectors) {
              rule.selectors = rule.selectors.map((sel: any) => {
                let newSel = sel.replace(/\bbody\b/g, '.cloned-content');
                if (!newSel.includes('.cloned-content')) newSel = '.cloned-content ' + newSel;
                return newSel;
              });
            }
          });
          styleContent = css.stringify(parsed);
        }
      } catch (e) {
        styleContent = `.cloned-content { ${styleContent} }`;
      }
      $(el).text(styleContent);
    } catch { }
  });

  // Apply the same <link> handling to any remaining body-level link elements.
  // React 19 hoists ALL <link> elements it finds inside dangerouslySetInnerHTML
  // to <head>, so any <link rel="preload"> without a valid `as` value triggers a
  // warning even if it was originally in the body, not the head.
  $('body link[rel~="preload"]').each((_, el) => {
    const asVal = ($(el).attr('as') || '').toLowerCase();
    const href = $(el).attr('href');
    if (asVal === 'style' && href) {
      try { $(el).attr('href', proxiedUrl(absoluteUrl(clonedBase, href))); } catch { }
      $(el).attr('rel', 'stylesheet');
      $(el).removeAttr('as');
      $(el).removeAttr('onload');
      $(el).removeAttr('onerror');
    } else if (asVal === 'font' && href) {
      try { $(el).attr('href', proxiedUrl(absoluteUrl(clonedBase, href))); } catch { }
    } else {
      $(el).remove();
    }
  });
  // Strip all remaining body hint/resource links — they are either redundant
  // (already handled above) or would cause React 19 hoisting warnings.
  $('body link[rel~="prefetch"], body link[rel~="modulepreload"], body link[rel~="preconnect"], body link[rel~="dns-prefetch"]').remove();
  // Promote any body stylesheet links (non-standard but some sites do it).
  $('body link[rel="stylesheet"]').each((_: any, el: any) => {
    const href = $(el).attr('href');
    if (href) {
      try { $(el).attr('href', proxiedUrl(absoluteUrl(clonedBase, href))); } catch { }
    }
  });

  const body = $('body').html() || '';
  const title = $('title').first().text().trim() || 'Annotation Page';
  const favicon = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href') || $('link[rel="apple-touch-icon"]').attr('href') || '';

  return { title, favicon, body, scripts };
});
