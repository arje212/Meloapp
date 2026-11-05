export default function BrandLogo({ className = '', size = 48, rounded = 'xl', alt = 'Melotrip logo' }) {
  const roundedClass = {
    none: '',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full',
  }[rounded] || 'rounded-xl';

  return (
    <img
      src="/icons/icon-192x192.png"
      alt={alt}
      width={size}
      height={size}
      className={`${roundedClass} object-cover shadow-sm ${className}`.trim()}
      style={{ width: size, height: size }}
    />
  );
}
