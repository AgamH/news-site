const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseArticleInput } = require('../src/utils/articleInput');

test('parseArticleInput accepts complete article fields and trims whitespace', () => {
  const article = parseArticleInput({
    title: '  City Watch  ',
    summary: '  A short summary.  ',
    content: '  Full article text.  ',
    category: 'Science',
    imageUrl: 'https://example.com/story.jpg',
  });

  assert.deepEqual(article, {
    title: 'City Watch',
    summary: 'A short summary.',
    content: 'Full article text.',
    category: 'Science',
    imageUrl: 'https://example.com/story.jpg',
  });
});

test('parseArticleInput rejects missing required fields and unknown categories', () => {
  for (const input of [
    { title: '', summary: 'Summary', content: 'Body', category: 'News' },
    { title: 'Title', summary: '', content: 'Body', category: 'News' },
    { title: 'Title', summary: 'Summary', content: '', category: 'News' },
    { title: 'Title', summary: 'Summary', content: 'Body', category: 'Unknown' },
  ]) {
    assert.throws(() => parseArticleInput(input), { statusCode: 400 });
  }
});

test('parseArticleInput restricts image URLs to HTTP and HTTPS', () => {
  assert.throws(() => parseArticleInput({
    title: 'Title',
    summary: 'Summary',
    content: 'Body',
    category: 'News',
    imageUrl: 'javascript:alert(1)',
  }), { statusCode: 400 });
});
