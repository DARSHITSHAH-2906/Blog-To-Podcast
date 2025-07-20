chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getBlogContent') {
    const article = document.querySelector('article');
    let text = '';
    if (article) {
      text = article.innerText;
    } else {
      // fallback: try to collect from paragraphs
      const paragraphs = document.querySelectorAll('p');
      text = Array.from(paragraphs).map(p => p.innerText).join('\\n');
    }
    sendResponse({ text });
  }
  return true; // needed for async response
});
