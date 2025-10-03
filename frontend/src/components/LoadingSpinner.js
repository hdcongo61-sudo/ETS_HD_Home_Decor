export default function LoadingSpinner({ text = 'Loading...' }) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div>
        <p className="text-gray-600">{text}</p>
      </div>
    );
  }