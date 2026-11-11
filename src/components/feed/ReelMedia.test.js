import { it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
globalThis.React = React;
const h = React.createElement;

it('video fills the full width and shows the side buttons', async () => {
  const { ReelMedia } = await import('@/components/feed/PostCard');
  const html = renderToStaticMarkup(h(ReelMedia, {
    src: 'https://x/v.mp4', isReel: true,
    actions: { liked: true, likesCount: 1234, commentsCount: 3, onLike() {}, onComment() {}, onShare() {}, saved: false, onSave() {} },
  }));
  expect(html).toContain('object-cover');           // no black bars at the sides
  expect(html).not.toContain('max-height');         // old 75vh cap removed
  expect(html).toContain('aria-label="Unlike"');    // liked -> can unlike
  expect(html).toContain('1.2K');                   // compact like count
  for (const label of ['Comments', 'Share', 'Save']) expect(html).toContain(`aria-label="${label}"`);
  expect(html).toContain('#t=0.1');                 // thumbnail frame
});
it('works without actions (no side column)', async () => {
  const { ReelMedia } = await import('@/components/feed/PostCard');
  const html = renderToStaticMarkup(h(ReelMedia, { src: 'https://x/v.mp4', isReel: false }));
  expect(html).not.toContain('aria-label="Share"');
});
