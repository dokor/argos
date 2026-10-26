import test from 'node:test';
import assert from 'node:assert/strict';
import {exceptionEvidence, scriptEvidence, resourceEvidence} from './evidence.mjs';

test('inline exceptions resolve to the audited document and delivered source coordinates', () => {
  const page='https://example.com/javascript_error?session=hidden';
  const item=exceptionEvidence({stack:'Error: private message\n    at load ('+page+':8:52)\n    at other (https://example.com/app.js:10:1)'},page);
  assert.equal(item.locationScope,'ANALYSED_DOCUMENT');
  assert.equal(item.resourceType,'document');
  assert.deepEqual(item.metrics,{sourceLine:8,sourceColumn:52});
  assert.equal(item.resourcePath,undefined);
  assert.doesNotMatch(JSON.stringify(item),/hidden|session|private|javascript_error/);
  assert.deepEqual(scriptEvidence('https://example.com/app.js?secret=x',0,9,page).metrics,{sourceLine:1,sourceColumn:10});
  assert.equal(scriptEvidence('https://example.com/other',1,1,page).locationScope,undefined);
  assert.equal(scriptEvidence('https://example.com/javascript_error?session=other',1,1,page).locationScope,undefined);
});

test('failed static resources retain their path while credentials and sensitive routes stay hidden', () => {
  assert.equal(resourceEvidence('https://user:secret@example.com/img/missing.jpg?token=x#part').resourcePath,'/img/missing.jpg');
  for(const path of ['/account/person','/private/avatar.png','/customers/1.jpg','/123456789.png'])
    assert.equal(resourceEvidence('https://example.com'+path).resourcePath,undefined);
  assert.equal(exceptionEvidence({stack:'Error: https://example.com/private:1:1'},'https://example.com/'),null);
  assert.equal(exceptionEvidence({stack:'Error\n    at anonymous (<anonymous>:1:2)'},'https://example.com/'),null);
});
