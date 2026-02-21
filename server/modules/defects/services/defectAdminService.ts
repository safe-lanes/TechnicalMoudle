import * as adminRepo from '../repositories/defectAdminRepository';

// ── Defect Categories ──

export async function getCategories() {
  return adminRepo.getCategories();
}

export async function createCategory(body: any) {
  const { name, sortOrder = 0, isActive = true } = body;
  if (!name?.trim()) {
    throw Object.assign(new Error("Category name is required"), { statusCode: 400 });
  }
  if (sortOrder !== undefined && typeof sortOrder !== 'number') {
    throw Object.assign(new Error("Sort order must be a number"), { statusCode: 400 });
  }
  return adminRepo.createCategory({ name: name.trim(), sortOrder, isActive });
}

export async function updateCategory(id: number, body: any) {
  if (isNaN(id)) {
    throw Object.assign(new Error("Invalid category ID"), { statusCode: 400 });
  }
  const { name, sortOrder, isActive } = body;
  if (name !== undefined && !name.trim()) {
    throw Object.assign(new Error("Category name cannot be empty"), { statusCode: 400 });
  }
  if (sortOrder !== undefined && typeof sortOrder !== 'number') {
    throw Object.assign(new Error("Sort order must be a number"), { statusCode: 400 });
  }
  const updates: any = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name.trim();
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  if (isActive !== undefined) updates.isActive = isActive;

  const category = await adminRepo.updateCategory(id, updates);
  if (!category) {
    throw Object.assign(new Error("Category not found"), { statusCode: 404 });
  }
  return category;
}

export async function deleteCategory(id: number) {
  const deleted = await adminRepo.deleteCategory(id);
  if (!deleted) {
    throw Object.assign(new Error("Category not found"), { statusCode: 404 });
  }
  return deleted;
}

// ── Defect Types ──

export async function getTypes() {
  return adminRepo.getTypes();
}

export async function createType(body: any) {
  const { name, sortOrder = 0, isActive = true } = body;
  if (!name?.trim()) {
    throw Object.assign(new Error("Defect type name is required"), { statusCode: 400 });
  }
  if (sortOrder !== undefined && typeof sortOrder !== 'number') {
    throw Object.assign(new Error("Sort order must be a number"), { statusCode: 400 });
  }
  return adminRepo.createType({ name: name.trim(), sortOrder, isActive });
}

export async function updateType(id: number, body: any) {
  if (isNaN(id)) {
    throw Object.assign(new Error("Invalid defect type ID"), { statusCode: 400 });
  }
  const { name, sortOrder, isActive } = body;
  if (name !== undefined && !name.trim()) {
    throw Object.assign(new Error("Defect type name cannot be empty"), { statusCode: 400 });
  }
  if (sortOrder !== undefined && typeof sortOrder !== 'number') {
    throw Object.assign(new Error("Sort order must be a number"), { statusCode: 400 });
  }
  const updates: any = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name.trim();
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  if (isActive !== undefined) updates.isActive = isActive;

  const defectType = await adminRepo.updateType(id, updates);
  if (!defectType) {
    throw Object.assign(new Error("Defect type not found"), { statusCode: 404 });
  }
  return defectType;
}

export async function deleteType(id: number) {
  const deleted = await adminRepo.deleteType(id);
  if (!deleted) {
    throw Object.assign(new Error("Defect type not found"), { statusCode: 404 });
  }
  return deleted;
}
