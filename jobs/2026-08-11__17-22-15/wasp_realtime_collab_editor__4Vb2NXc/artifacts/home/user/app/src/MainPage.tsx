import { useState } from "react";
import { Link } from "react-router";
import { logout } from "wasp/client/auth";
import { useQuery, getDocuments, createDocument } from "wasp/client/operations";
import type { AuthUser } from "wasp/auth";

export function MainPage({ user }: { user: AuthUser }) {
  const { data: documents, error, isLoading } = useQuery(getDocuments);
  const [newTitle, setNewTitle] = useState("");
  const [createError, setCreateError] = useState("");

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!newTitle.trim()) {
      setCreateError("Title is required");
      return;
    }

    try {
      await createDocument({ title: newTitle });
      setNewTitle("");
    } catch (err: any) {
      setCreateError(err.message || "Failed to create document");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <span className="text-xl font-bold text-blue-600">CollabEdit</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Logged in as <strong className="font-semibold">{user.username}</strong>
              </span>
              <button
                onClick={logout}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Create Document Form */}
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 h-fit">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Create New Document</h3>
            <form onSubmit={handleCreateDocument} className="space-y-4">
              <div>
                <label htmlFor="document-title-input" className="block text-sm font-medium text-gray-700 mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  id="document-title-input"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Project Proposal"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <button
                type="submit"
                id="create-document-btn"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Create Document
              </button>
            </form>
          </div>

          {/* Document List */}
          <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Your Documents</h3>

            {isLoading && <p className="text-gray-600">Loading documents...</p>}
            {error && <p className="text-red-600">Error loading documents: {error.message}</p>}

            {!isLoading && !error && (!documents || documents.length === 0) && (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-500">No documents found. Create one to get started!</p>
              </div>
            )}

            {!isLoading && !error && documents && documents.length > 0 && (
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                        Title
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Owner
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Access
                      </th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {documents.map((doc: any) => {
                      const isOwner = doc.ownerId === user.id;
                      const accessRole = isOwner ? "Owner" : doc.permissions[0]?.role || "VIEW";
                      return (
                        <tr key={doc.id}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                            <Link to={`/document/${doc.id}`} className="text-blue-600 hover:text-blue-900 hover:underline">
                              {doc.title}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {isOwner ? "me" : doc.owner.username}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                accessRole === "Owner"
                                  ? "bg-green-100 text-green-800"
                                  : accessRole === "EDIT"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {accessRole}
                            </span>
                          </td>
                          <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <Link to={`/document/${doc.id}`} className="text-blue-600 hover:text-blue-900">
                              Open
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
export default MainPage;
