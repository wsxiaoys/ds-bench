export const User = ({ params }: { params: { id: string } }) => {
  return (
    <div>
      <h1>User profile: {params.id}</h1>
    </div>
  );
};
