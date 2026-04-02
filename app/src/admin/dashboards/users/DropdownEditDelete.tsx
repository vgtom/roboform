import { Ellipsis, SquarePen, Trash2 } from "lucide-react";
import { useAuth } from "wasp/client/auth";
import {
  deleteUserById,
  updateIsUserAdminById,
} from "wasp/client/operations";
import { type User } from "wasp/entities";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../client/components/ui/dropdown-menu";

const DropdownEditDelete = ({
  user,
  onMutationSuccess,
}: {
  user: Pick<User, "id" | "isAdmin">;
  onMutationSuccess?: () => void;
}) => {
  const { data: currentUser } = useAuth();
  const isCurrentUser = currentUser?.id === user.id;
  const canEdit = !!currentUser?.isAdmin && !isCurrentUser;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button>
          <Ellipsis className="size-4" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          disabled={!canEdit}
          onSelect={async (e) => {
            e.preventDefault();
            if (!canEdit) return;
            await updateIsUserAdminById({ id: user.id, isAdmin: !user.isAdmin });
            onMutationSuccess?.();
          }}
        >
          <SquarePen className="mr-2 size-4" />
          Edit
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={!canEdit}
          onSelect={async (e) => {
            e.preventDefault();
            if (!canEdit) return;
            const ok = window.confirm(
              "Deactivate this user? This will set the account back to Free/Deleted.",
            );
            if (!ok) return;
            await deleteUserById({ id: user.id });
            onMutationSuccess?.();
          }}
        >
          <Trash2 className="mr-2 size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default DropdownEditDelete;
