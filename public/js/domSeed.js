export function seedSyntheticDom({ articles = 80, ctaPerArticle = 5 } = {}) {
  const existing = document.querySelector('.content-block');
  if (existing) {
    return existing;
  }

  const root = document.createElement('section');
  root.className = 'content-block';
  root.hidden = true;

  for (let i = 0; i < articles; i += 1) {
    const article = document.createElement('article');
    article.className = i % 3 === 0 ? 'highlight' : 'standard';
    article.dataset.node = i % 2 === 0 ? 'story' : 'product';

    const heading = document.createElement('h3');
    heading.textContent = `Synthetic content block ${i + 1}`;
    article.appendChild(heading);

    const paragraph = document.createElement('p');
    paragraph.textContent =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam vitae.';
    article.appendChild(paragraph);

    const list = document.createElement('ul');
    list.className = 'cta-list';

    for (let j = 0; j < ctaPerArticle; j += 1) {
      const li = document.createElement('li');
      li.dataset.node = j % 2 === 0 ? 'cta' : 'link';
      li.textContent = `Call-to-action ${j + 1}`;
      list.appendChild(li);
    }

    article.appendChild(list);
    root.appendChild(article);
  }

  document.body.appendChild(root);
  return root;
}
