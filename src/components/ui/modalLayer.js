import { useEffect } from 'react';

let modalLockCount = 0;
let lockedScrollY = 0;
let savedDocumentStyles = null;

const lockDocumentScroll = () => {
  modalLockCount += 1;
  if (modalLockCount > 1) return;
  const html = document.documentElement;
  const body = document.body;
  lockedScrollY = window.scrollY;
  savedDocumentStyles = {
    htmlOverflow: html.style.overflow,
    bodyOverflow: body.style.overflow,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyWidth: body.style.width,
    bodyPaddingRight: body.style.paddingRight
  };
  const scrollbarWidth = window.innerWidth - html.clientWidth;
  html.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = `-${lockedScrollY}px`;
  body.style.width = '100%';
  if (scrollbarWidth > 0 && window.innerWidth >= 576) {
    body.style.paddingRight = `${scrollbarWidth}px`;
  }
};

const unlockDocumentScroll = () => {
  modalLockCount = Math.max(0, modalLockCount - 1);
  if (modalLockCount || !savedDocumentStyles) return;
  const html = document.documentElement;
  const body = document.body;
  html.style.overflow = savedDocumentStyles.htmlOverflow;
  body.style.overflow = savedDocumentStyles.bodyOverflow;
  body.style.position = savedDocumentStyles.bodyPosition;
  body.style.top = savedDocumentStyles.bodyTop;
  body.style.width = savedDocumentStyles.bodyWidth;
  body.style.paddingRight = savedDocumentStyles.bodyPaddingRight;
  const restoreY = lockedScrollY;
  savedDocumentStyles = null;
  window.scrollTo(0, restoreY);
};

export const useModalLayer = (open) => {
  useEffect(() => {
    if (!open) return undefined;
    lockDocumentScroll();
    return unlockDocumentScroll;
  }, [open]);
};
