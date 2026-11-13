(() => {
  // One renderer for the public feed and the order preview.
  window.buildAdCreative = (ad, mobile = false) => {
    const makeMeta = () => {
      if (!(ad.company || ad.publicPhone || ad.publicEmail || ad.contact)) return null;
      const meta = document.createElement('div'); meta.className = 'ad-creative__meta';
      for (const [value, tag, className] of [[ad.company,'strong','ad-creative__company'],[ad.publicPhone,'span','ad-creative__contact'],[ad.publicEmail,'span','ad-creative__contact'],[ad.contact,'span','ad-creative__contact']]) {
        if (!value) continue;
        const item = document.createElement(tag); item.className = className; item.textContent = value;
        if (meta.childElementCount) item.classList.add('ad-creative__contact--separated');
        meta.append(item);
      }
      return meta;
    };
    if (ad.image) {
      const frame = document.createElement('div'); frame.className = `ad-image-creative ad-image-creative--${ad.type.toLowerCase()}`;
      const picture = document.createElement('picture');
      const mobileImage = ad.imageMobile || ad.image;
      if (mobileImage !== ad.image) {
        const source = document.createElement('source'); source.media = '(max-width: 580px)'; source.srcset = mobileImage; picture.append(source);
      }
      const image = document.createElement('img'); image.src = mobile && ad.type === 'PREMIUM' ? mobileImage : ad.image;
      image.alt = ad.company || ad.title; image.loading = 'lazy'; picture.append(image);
      frame.append(picture);
      const meta = makeMeta(); if (meta) frame.append(meta);
      return frame;
    }
    const frame = document.createElement('div');
    frame.className = `ad-creative ad-creative--${ad.type.toLowerCase()}`;
    const titleLength = Array.from(ad.title || '').length;
    const descriptionLength = Array.from(ad.description || '').length;
    if (ad.type === 'PREMIUM' && (titleLength > 60 || descriptionLength > 170) || ad.type === 'TOP' && (titleLength > 50 || descriptionLength > 140)) frame.classList.add('ad-creative--dense');
    if (mobile) frame.classList.add('ad-creative--mobile');
    const copy = document.createElement('div'); copy.className = 'ad-creative__copy';
    for (const [tag, value, className] of [['h3', ad.title, 'ad-creative__title'], ['p', ad.description, 'ad-creative__description']]) {
      if (!value) continue;
      const node = document.createElement(tag); node.className = className; node.textContent = value; copy.append(node);
    }
    const meta = makeMeta(); if (meta) copy.append(meta);
    frame.append(copy); return frame;
  };
})();
