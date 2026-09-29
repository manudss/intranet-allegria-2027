import { faqCategories } from './faq.content';

describe('faqCategories', () => {
  it('has a unique id for every category', () => {
    const ids = faqCategories.map((category) => category.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has at least one question per category', () => {
    for (const category of faqCategories) {
      expect(category.items.length).toBeGreaterThan(0);
    }
  });

  it('has a unique item id within each category (used to build stable anchors)', () => {
    for (const category of faqCategories) {
      const itemIds = category.items.map((item) => item.id);
      expect(new Set(itemIds).size).toBe(itemIds.length);
    }
  });
});
