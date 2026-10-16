import ReactDOM from 'react-dom/client';
import App from './App';
import 'dockview-react/dist/styles/dockview.css';
import './styles/base.css';
import './styles/panels.css';
import './styles/workspaces.css';
import './styles/agent.css';
import './styles/updates.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<App/>);
