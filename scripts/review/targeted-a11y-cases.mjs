// Synthetic, paired documents. The installed Lighthouse/axe rules must fail before
// and pass after the stated DOM change. These are not reports fabricated from prose.
const cases = [];
const add = (id, before, after, change, options = {}) => cases.push({id, before, after, change, ...options});
add('accesskeys', '<button accesskey="s">Save</button><button accesskey="s">Search</button>', '<button>Save</button><button>Search</button>', 'accesskey');
add('aria-allowed-attr', '<button aria-level="2">Save</button>', '<button>Save</button>', 'aria-level');
add('aria-prohibited-attr', '<p aria-label="Description"></p>', '<p>Text</p>', 'aria-label');
add('aria-command-name', '<div role="button" tabindex="0"></div>', '<div role="button" tabindex="0">Save</div>', 'name');
add('aria-conditional-attr', '<input type="checkbox" aria-checked="mixed">', '<input type="checkbox">', 'aria-checked');
add('aria-deprecated-role', '<div role="directory"><span>Entry</span></div>', '<ul><li>Entry</li></ul>', 'role');
add('aria-dialog-name', '<div role="dialog">Content</div>', '<div role="dialog" aria-label="Details">Content</div>', 'aria-label');
add('aria-hidden-body', '<p>Content</p>', '<p>Content</p>', 'aria-hidden', {beforeBody: 'aria-hidden="true"'});
add('aria-hidden-focus', '<div aria-hidden="true"><button>Save</button></div>', '<div><button>Save</button></div>', 'aria-hidden');
for (const [id,role,attrs] of [
  ['aria-input-field-name','textbox',''], ['aria-meter-name','meter','aria-valuenow="5"'],
  ['aria-progressbar-name','progressbar','aria-valuenow="5"'], ['aria-toggle-field-name','checkbox','aria-checked="false"'],
  ['aria-tooltip-name','tooltip',''], ['aria-treeitem-name','treeitem',''],
]) add(id, `<div role="${role}" ${attrs}></div>`, `<div role="${role}" ${attrs} aria-label="Volume"></div>`, 'aria-label');
add('aria-required-attr', '<div role="slider" aria-label="Volume"></div>', '<div role="slider" aria-label="Volume" aria-valuenow="5"></div>', 'aria-valuenow');
add('aria-required-children', '<div role="listbox" aria-label="Choice"><div>One</div></div>', '<div role="listbox" aria-label="Choice"><div role="option" aria-selected="true">One</div></div>', 'option');
add('aria-required-parent', '<div role="option">One</div>', '<div role="listbox" aria-label="Choice"><div role="option">One</div></div>', 'listbox');
add('aria-roles', '<div role="buton">Save</div>', '<button>Save</button>', 'role');
add('aria-text', '<div role="text">Visit <a href="#details">details</a></div>', '<div>Visit <a href="#details">details</a></div>', 'role');
add('aria-valid-attr', '<button aria-labl="Save">Save</button>', '<button>Save</button>', 'aria-labl');
add('aria-valid-attr-value', '<button aria-expanded="maybe">Details</button>', '<button aria-expanded="false">Details</button>', 'aria-expanded');
add('autocomplete-valid', '<input aria-label="Name" autocomplete="firstname">', '<input aria-label="Name" autocomplete="given-name">', 'autocomplete');
add('button-name', '<button></button>', '<button>Save</button>', 'name');
add('color-contrast', '<p style="color:#aaa;background:white">Readable text</p>', '<p style="color:#111;background:white">Readable text</p>', 'color');
add('definition-list', '<dl><div>Unexpected child</div></dl>', '<dl><dt>Term</dt><dd>Description</dd></dl>', 'dt');
add('dlitem', '<dt>Term</dt><dd>Description</dd>', '<dl><dt>Term</dt><dd>Description</dd></dl>', 'dl');
add('document-title', '<p>Content</p>', '<p>Content</p>', 'title', {beforeTitle: ''});
add('frame-title', '<iframe srcdoc="<p>Demo</p>"></iframe>', '<iframe title="Demo" srcdoc="<p>Demo</p>"></iframe>', 'title');
add('heading-order', '<h1>Title</h1><h3>Section</h3>', '<h1>Title</h1><h2>Section</h2>', 'heading');
add('html-has-lang', '<p>Text</p>', '<p>Text</p>', 'lang', {beforeHtml: ''});
add('html-lang-valid', '<p>Text</p>', '<p>Text</p>', 'lang', {beforeHtml: 'lang="invalid"'});
add('html-xml-lang-mismatch', '<p>Text</p>', '<p>Text</p>', 'lang', {beforeHtml:'lang="en" xml:lang="fr"'});
add('valid-lang', '<p lang="invalid">Text</p>', '<p lang="en">Text</p>', 'lang');
add('image-alt', '<img src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E">', '<img alt="" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E">', 'alt');
add('input-button-name', '<input type="button">', '<input type="button" value="Save">', 'value');
add('input-image-alt', '<input type="image" src="data:image/png;base64,AA==">', '<input type="image" alt="Search" src="data:image/png;base64,AA==">', 'alt');
add('label-content-name-mismatch', '<button aria-label="Erase">Save</button>', '<button>Save</button>', 'name');
add('label', '<input type="text">', '<label for="name">Name</label><input id="name" type="text">', 'label');
add('landmark-one-main', '<p>Text</p>', '<main><p>Text</p></main>', 'main');
add('link-in-text-block', '<p style="color:#000">Text <a href="#details" style="color:#222;text-decoration:none">details</a> text</p>', '<p style="color:#000">Text <a href="#details" style="color:#222;text-decoration:underline">details</a> text</p>', 'underline');
add('link-name', '<a href="#details"></a>', '<a href="#details">Details</a>', 'name');
add('list', '<ul><div>One</div></ul>', '<ul><li>One</li></ul>', 'li');
add('listitem', '<li>One</li>', '<ul><li>One</li></ul>', 'ul');
add('meta-refresh', '<p>Text</p>', '<p>Text</p>', 'refresh', {beforeHead:'<meta http-equiv="refresh" content="3600">'});
add('meta-viewport', '<p>Text</p>', '<p>Text</p>', 'user-scalable', {beforeHead:'<meta name="viewport" content="width=device-width,user-scalable=no">',afterHead:'<meta name="viewport" content="width=device-width,initial-scale=1">'});
add('object-alt', '<object type="text/html" data="data:text/html,Demo"></object>', '<object aria-label="Demo" type="text/html" data="data:text/html,Demo"></object>', 'aria-label');
add('presentation-role-conflict', '<button role="presentation">Save</button>', '<button>Save</button>', 'role');
add('select-name', '<select><option>One</option></select>', '<label for="choice">Choice</label><select id="choice"><option>One</option></select>', 'label');
add('skip-link', '<a style="position:absolute;left:-10000px" href="#missing">Skip to content</a><main id="content">Text</main>', '<a style="position:absolute;left:-10000px" href="#content">Skip to content</a><main id="content" tabindex="-1">Text</main>', 'href');
add('svg-img-alt', '<svg role="img" width="80" height="80"><circle r="20" cx="40" cy="40"/></svg>', '<svg role="img" aria-label="Circle" width="80" height="80"><circle r="20" cx="40" cy="40"/></svg>', 'aria-label');
add('tabindex', '<button tabindex="2">Save</button>', '<button>Save</button>', 'tabindex');
add('table-fake-caption', '<table><tr><td colspan="2">Prices</td></tr><tr><th>Product</th><th>Price</th></tr><tr><td>Book</td><td>5</td></tr></table>', '<table><caption>Prices</caption><tr><th>Product</th><th>Price</th></tr><tr><td>Book</td><td>5</td></tr></table>', 'caption');
add('target-size', '<button style="width:10px;height:10px;padding:0"></button><button style="width:10px;height:10px;padding:0"></button>', '<button style="width:44px;height:44px">One</button><button style="width:44px;height:44px">Two</button>', 'size');
add('td-has-header', '<table><tr><th>Name</th><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td><td>E</td></tr><tr><td>F</td><td>G</td><td>H</td></tr></table>', '<table><tr><th scope="col">Name</th><th scope="col">A</th><th scope="col">B</th></tr><tr><td>C</td><td>D</td><td>E</td></tr><tr><td>F</td><td>G</td><td>H</td></tr></table>', 'th');
add('td-headers-attr', '<table><tr><th id="name">Name</th></tr><tr><td headers="missing">Book</td></tr></table>', '<table><tr><th id="name">Name</th></tr><tr><td headers="name">Book</td></tr></table>', 'headers');

export const a11yCases = cases;
export function documentFor(test, fixed) {
  const state = fixed ? 'after' : 'before';
  return `<!doctype html><html ${test[state+'Html'] ?? 'lang="en"'}><head><meta charset="utf-8"><title>${test[state+'Title'] ?? 'Targeted accessibility case'}</title>${test[state+'Head'] ?? ''}</head><body ${test[state+'Body'] ?? ''}>${test[state]}</body></html>`;
}
