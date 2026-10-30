import React from 'react';
export default function Link({ href, children, onClick, ...props }: any) {
  const local = href === '/projects' || /^\/editor\/[\w-]+$/.test(href);
  return (
    <a
      {...props}
      href={local ? '#' + href : undefined}
      onClick={(e) => {
        onClick?.(e);
        if (!local) e.preventDefault();
      }}
    >
      {children}
    </a>
  );
}
