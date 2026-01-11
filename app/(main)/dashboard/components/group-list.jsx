import Link from "next/link";
import { Users } from "lucide-react";

export function GroupList({ groups }) {
  if (!groups || groups.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-muted-foreground">No groups yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Create a group to start tracking shared expenses
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        // Calculate total balance in the group
        const balance = group.balance || 0;
        const hasBalance = balance !== 0;

        return (
          <Link
            href={`/groups/${group.id}`}
            key={group.id}
            className="flex items-center justify-between hover:bg-muted p-2 rounded-md transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-md">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{group.name}</p>
                <p className="text-xs text-muted-foreground">
                  {group.members.length} members
                </p>
              </div>
            </div>

            {hasBalance && (
              <span
                className={`text-sm font-medium ${
                  balance > 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {balance > 0 ? "+" : ""}${balance.toFixed(2)}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

// import Link from "next/link";
// import { Users, Trash2 } from "lucide-react";
// import { useMutation } from "convex/react";
// import { api } from "@/convex/_generated/api";
// import { toast } from "sonner";

// export function GroupList({ groups }) {
//   const deleteGroup = useMutation(api.groups.deleteGroup);

//   const handleDelete = async (e, groupId, groupName) => {
//     // 1. Stop the Link from being clicked when we click the delete button
//     e.preventDefault();
//     e.stopPropagation();

//     const confirmed = confirm(`Are you sure you want to delete the group "${groupName}"? This will delete all expenses inside it.`);
    
//     if (confirmed) {
//       try {
//         await deleteGroup({ id: groupId });
//         toast.success("Group deleted");
//       } catch (error) {
//         toast.error("Failed to delete group: " + error.message);
//       }
//     }
//   };

//   if (!groups || groups.length === 0) {
//     return (
//       <div className="text-center py-6">
//         <p className="text-muted-foreground">No groups yet</p>
//         <p className="text-sm text-muted-foreground mt-1">
//           Create a group to start tracking shared expenses
//         </p>
//       </div>
//     );
//   }

//   return (
//     <div className="space-y-3">
//       {groups.map((group) => {
//         const balance = group.balance || 0;
//         const hasBalance = balance !== 0;

//         return (
//           <Link
//             href={`/groups/${group.id}`}
//             key={group.id}
//             className="group flex items-center justify-between hover:bg-muted p-2 rounded-md transition-colors relative"
//           >
//             <div className="flex items-center gap-3">
//               <div className="bg-primary/10 p-2 rounded-md">
//                 <Users className="h-5 w-5 text-primary" />
//               </div>
//               <div>
//                 <p className="font-medium">{group.name}</p>
//                 <p className="text-xs text-muted-foreground">
//                   {group.members.length} members
//                 </p>
//               </div>
//             </div>

//             <div className="flex items-center gap-4">
//               {hasBalance && (
//                 <span
//                   className={`text-sm font-medium ${
//                     balance > 0 ? "text-green-600" : "text-red-600"
//                   }`}
//                 >
//                   {balance > 0 ? "+" : ""}${balance.toFixed(2)}
//                 </span>
//               )}

//               {/* Delete Button - Only visible on hover for a cleaner look */}
//               <button
//                 onClick={(e) => handleDelete(e, group.id, group.name)}
//                 className="opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
//                 title="Delete Group"
//               >
//                 <Trash2 className="h-4 w-4" />
//               </button>
//             </div>
//           </Link>
//         );
//       })}
//     </div>
//   );
// }