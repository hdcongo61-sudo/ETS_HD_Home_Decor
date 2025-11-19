const resolveEntity = (entityOrId, slug) => {
  if (!entityOrId) {
    return { id: null, slug: slug || null };
  }

  if (typeof entityOrId === 'object') {
    return {
      id: entityOrId._id || entityOrId.id,
      slug: entityOrId.slug || slug || null,
    };
  }

  return { id: entityOrId, slug: slug || null };
};

const buildPath = (base, entityOrId, slug, suffix = '') => {
  const { id, slug: resolvedSlug } = resolveEntity(entityOrId, slug);
  if (!id) return `${base}${suffix}`;
  return `${base}/${id}${resolvedSlug ? `/${resolvedSlug}` : ''}${suffix}`;
};

export const productPath = (entityOrId, slug) => buildPath('/products', entityOrId, slug);
export const productEditPath = (entityOrId, slug) => buildPath('/products/edit', entityOrId, slug);
export const clientPath = (entityOrId, slug) => buildPath('/clients', entityOrId, slug);
export const employeeBasePath = (entityOrId, slug) => buildPath('/employees', entityOrId, slug);
export const employeeEditPath = (entityOrId, slug) =>
  buildPath('/employees', entityOrId, slug, '/edit');
export const employeePayrollPath = (entityOrId, slug) =>
  buildPath('/employees', entityOrId, slug, '/payroll');
export const employeePayrollNewPath = (entityOrId, slug) =>
  `${employeePayrollPath(entityOrId, slug)}/new`;
export const employeePayrollPayslipEditPath = (entityOrId, slug, payslipId) =>
  `${employeePayrollPath(entityOrId, slug)}/${payslipId}/edit`;
export const employeePayrollPayslipPrintPath = (entityOrId, slug, payslipId) =>
  `${employeePayrollPath(entityOrId, slug)}/${payslipId}/print`;
export const employeeAdvancesPath = (entityOrId, slug) =>
  buildPath('/employees', entityOrId, slug, '/advances');
export const employeeAdvancesNewPath = (entityOrId, slug) =>
  `${employeeAdvancesPath(entityOrId, slug)}/new`;
