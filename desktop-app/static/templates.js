// Handlebars templates — compiled once at load.
// Compressed language mirrors design/compressy.html: floating "Compressed"
// tag on grid thumbs (inline tag by the name in list rows), struck-through
// before → green after sizes, output dims. Context values are precomputed
// by app.js (sizes formatted, labels built).
window.CompressyTemplates = (() => {
  const fileRow = Handlebars.compile(
    `<label class="row{{#if selected}} selected{{/if}}{{#if compressed}} is-compressed{{/if}}" title="{{title}}">
      <input type="checkbox" data-path="{{path}}"{{#if selected}} checked{{/if}}>
      <span class="thumb-wrap">
        <span class="thumb thumb--{{ext}}"><img src="/thumb?path={{thumbUrl}}" alt="" loading="lazy" decoding="async"></span>
      </span>
      <span class="file-meta">
        <span class="file-name" title="{{name}}">{{name}}{{#if compressed}}<span class="float-tag-inline">Compressed</span>{{/if}}{{#if renamed}} <em class="r-renamed">renamed</em>{{/if}}</span>
        {{#if folder}}<span class="file-folder" title="{{folder}}">{{folder}}</span>{{/if}}
      </span>
      <span class="size">{{#if compressed}}<s>{{before}}</s> → <strong class="sz-new">{{after}}</strong>{{else}}{{size}}{{/if}}</span>
      <span class="dim">{{dims}}</span>
    </label>`,
  );

  const gridCard = Handlebars.compile(
    `<label class="gcard{{#if selected}} selected{{/if}}{{#if compressed}} is-compressed{{/if}}" title="{{title}}">
      <input type="checkbox" data-path="{{path}}"{{#if selected}} checked{{/if}}>
      <span class="g-thumb-wrap">
        <span class="gthumb thumb--{{ext}}"><img src="/thumb?path={{thumbUrl}}" alt="" loading="lazy" decoding="async"></span>
        {{#if compressed}}<span class="float-tag">Compressed</span>{{/if}}
      </span>
      <span class="gname" title="{{name}}">{{name}}{{#if renamed}} <em class="r-renamed">renamed</em>{{/if}}</span>
      <span class="gmeta">{{#if compressed}}<s>{{before}}</s> → <strong class="sz-new">{{after}}</strong> · {{dims}}{{else}}{{size}} · {{dims}}{{/if}}</span>
    </label>`,
  );

  const fileEmpty = Handlebars.compile(
    `<div class="empty"><div class="empty-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.2" stroke="currentColor" stroke-width="1.3"/><path d="M10.2 10.2L13 13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></div><strong>{{title}}</strong>{{sub}}</div>`,
  );

  return { fileRow, gridCard, fileEmpty };
})();
