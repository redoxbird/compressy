// Handlebars templates — compiled once at load.
// Context values are precomputed by app.js (sizes formatted, labels built).
window.CompressyTemplates = (() => {
  const checkSvg = `<svg viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M1.5 5.2l2.2 2.3L8.5 2.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const fileRow = Handlebars.compile(
    `<label class="row{{#if selected}} selected{{/if}}{{#if compressed}} is-compressed{{/if}}" title="{{title}}">
      <input type="checkbox" data-path="{{path}}"{{#if selected}} checked{{/if}}>
      <span class="thumb-wrap">
        <span class="thumb thumb--{{ext}}"><img src="/thumb?path={{thumbUrl}}" alt="" loading="lazy" decoding="async"></span>
        {{#if compressed}}<span class="compressed-dot" aria-hidden="true">${checkSvg}</span>{{/if}}
      </span>
      <span class="file-meta">
        <span class="file-name" title="{{name}}">{{name}}{{#if compressed}} <span class="compressed-pill">Compressed</span>{{/if}}{{#if renamed}} <em class="r-renamed">renamed</em>{{/if}}</span>
        {{#if compressed}}<span class="saving-line">{{before}} → {{after}} · <strong>-{{pct}}% · -{{saved}}</strong> <span class="mini-bar"><i style="width:{{miniWidth}}%"></i></span>{{#if resized}} · {{origW}}×{{origH}} → {{w}}×{{h}}{{/if}}</span>{{/if}}
        {{#if folder}}<span class="file-folder" title="{{folder}}">{{folder}}</span>{{/if}}
      </span>
      <span class="size">{{size}}</span>
      <span class="dim">{{dims}}</span>
    </label>`,
  );

  const gridCard = Handlebars.compile(
    `<label class="gcard{{#if selected}} selected{{/if}}{{#if compressed}} is-compressed{{/if}}" title="{{title}}">
      <input type="checkbox" data-path="{{path}}"{{#if selected}} checked{{/if}}>
      <span class="g-thumb-wrap">
        <span class="gthumb thumb--{{ext}}"><img src="/thumb?path={{thumbUrl}}" alt="" loading="lazy" decoding="async"></span>
        {{#if compressed}}<span class="compressed-dot" aria-hidden="true">${checkSvg}</span>{{/if}}
      </span>
      <span class="gname" title="{{name}}">{{name}}{{#if compressed}} <span class="compressed-pill">Compressed</span>{{/if}}{{#if renamed}} <em class="r-renamed">renamed</em>{{/if}}</span>
      <span class="gmeta">{{size}} · {{dims}}</span>
      {{#if compressed}}<span class="g-saving">{{before}} → {{after}} · <strong>-{{pct}}% · -{{saved}}</strong> <span class="mini-bar"><i style="width:{{miniWidth}}%"></i></span>{{#if resized}} · {{origW}}×{{origH}} → {{w}}×{{h}}{{/if}}</span>{{/if}}
    </label>`,
  );

  const fileEmpty = Handlebars.compile(
    `<div class="empty"><div class="empty-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.2" stroke="currentColor" stroke-width="1.3"/><path d="M10.2 10.2L13 13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></div><strong>{{title}}</strong>{{sub}}</div>`,
  );

  return { fileRow, gridCard, fileEmpty };
})();
