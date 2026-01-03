export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
          Check Your Domain's
          <span className="text-primary-600"> DMARC Configuration</span>
        </h1>
        <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
          Validate your domain's DMARC record and improve email security. 
          Get detailed analysis and recommendations for better email authentication.
        </p>
      </div>

      <div className="mt-12 max-w-lg mx-auto">
        <div className="card">
          <form className="space-y-4">
            <div>
              <label htmlFor="domain" className="block text-sm font-medium text-gray-700">
                Domain Name
              </label>
              <input
                type="text"
                id="domain"
                name="domain"
                placeholder="example.com"
                className="input-field mt-1"
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full"
            >
              Check DMARC Configuration
            </button>
          </form>
        </div>
      </div>

      <div className="mt-16">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            Why DMARC Matters
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-500">
            DMARC helps protect your domain from email spoofing and phishing attacks
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="card text-center">
            <h3 className="text-lg font-medium text-gray-900">Email Security</h3>
            <p className="mt-2 text-gray-500">
              Prevent unauthorized use of your domain in email attacks
            </p>
          </div>
          <div className="card text-center">
            <h3 className="text-lg font-medium text-gray-900">Brand Protection</h3>
            <p className="mt-2 text-gray-500">
              Protect your brand reputation from email-based fraud
            </p>
          </div>
          <div className="card text-center">
            <h3 className="text-lg font-medium text-gray-900">Deliverability</h3>
            <p className="mt-2 text-gray-500">
              Improve email deliverability with proper authentication
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}