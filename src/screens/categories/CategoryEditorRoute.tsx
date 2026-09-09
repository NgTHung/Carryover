import { categoryData } from '../../data/database';
import { CategoryEditorScreen } from './CategoryEditorScreen';

export default function CategoryEditorRoute() {
  return <CategoryEditorScreen data={categoryData} />;
}
