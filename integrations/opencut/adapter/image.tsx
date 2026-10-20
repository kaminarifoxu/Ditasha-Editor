import React from 'react';
export default function Image({
  src,
  fill,
  priority,
  unoptimized,
  quality,
  loader,
  ...props
}: any) {
  return (
    <img
      {...props}
      src={typeof src === 'string' ? src : src?.src}
      style={{
        ...props.style,
        ...(fill
          ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }
          : {}),
      }}
    />
  );
}
