export const UserProfile = ({ params }: { params: { id: string } }) => {
  return (
    <div>
      User profile: {params.id}
    </div>
  );
};
