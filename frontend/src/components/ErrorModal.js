export default function ErrorModal({ message, onRetry, onClose }) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
          <div className="bg-red-600 p-4 rounded-t-lg">
            <h3 className="text-lg font-semibold text-white">Error</h3>
          </div>
          
          <div className="p-6">
            <p className="text-gray-700 mb-4">{message}</p>
            
            <div className="flex justify-end space-x-3">
              {onRetry && (
                <button 
                  onClick={onRetry}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
              )}
              <button 
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }