const slugifyValue = (value) => {
  if (!value && value !== 0) return '';
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
};

const generateSlug = (value) => {
  const base = slugifyValue(value || '');
  return base || `item-${Date.now().toString(36)}`;
};

module.exports = generateSlug;
