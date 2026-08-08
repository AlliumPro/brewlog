import { useNavigate } from 'react-router';

import { useDeleteBrewMutation } from '@/entities/brew';
import { Button, ConfirmDialog } from '@/shared/ui';

interface DeleteBrewButtonProps {
  id: string;
  /** Named in the dialog so the user can see what is about to disappear. */
  beanName: string;
}

export function DeleteBrewButton({ id, beanName }: DeleteBrewButtonProps) {
  const [deleteBrew, { isLoading }] = useDeleteBrewMutation();
  const navigate = useNavigate();

  return (
    <ConfirmDialog
      trigger={<Button variant="ghost">Delete</Button>}
      title="Delete this brew?"
      description={`The entry for ${beanName} will be removed for good, along with its photo. This cannot be undone.`}
      confirmLabel="Delete it"
      busy={isLoading}
      onConfirm={() => {
        void deleteBrew(id)
          .unwrap()
          .then(() => {
            void navigate('/', { replace: true });
          });
      }}
    />
  );
}
