import LogViewer from './components/LogViewer'
import { ErrorBoundary } from './components/ErrorBoundary'

function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <LogViewer />
    </ErrorBoundary>
  )
}

export default App
