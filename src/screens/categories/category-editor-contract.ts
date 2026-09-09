import type {
  Category,
  CategoryGroupWithLeaves,
} from '../../data/category-types';
import type {
  CreateCategoryInput,
  RenameCategoryInput,
  ReorderCategoriesInput,
  SetCategoryGroupKindInput,
} from '../../data/category-validation';
import type { CategoryKind } from '../../data/category-types';

export type CategoryEditorData = {
  listActiveCategoryGroups(): Promise<CategoryGroupWithLeaves[]>;
  createCategory(input: CreateCategoryInput): Promise<Category>;
  renameCategory(input: RenameCategoryInput): Promise<void>;
  setCategoryGroupKind(input: SetCategoryGroupKindInput): Promise<void>;
  reorderCategories(input: ReorderCategoriesInput): Promise<void>;
  softDeleteCategory(categoryId: string): Promise<void>;
  deleteSuggestedCategories(): Promise<void>;
};

export type CategoryEditorFormState =
  | { status: 'closed' }
  | { status: 'group'; name: string; kind: CategoryKind; error?: string }
  | { status: 'leaf'; groupId: string; name: string; error?: string }
  | { status: 'rename'; categoryId: string; name: string; error?: string };

export type CategoryEditorDeleteState =
  | { status: 'closed' }
  | { status: 'open'; categoryId: string; label: string; detail: string };
