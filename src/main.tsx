import ReactDOM from 'react-dom/client';
import { initializeLanguage } from './i18n';
import 'dockview-react/dist/styles/dockview.css';
import './styles/base.css';
import './styles/panels.css';
import './styles/workspaces.css';
import './styles/agent.css';
import './styles/updates.css';
import './styles/config-tools.css';
import './styles/i18n.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);
void initializeLanguage().catch(error => console.error('Unable to read interface language', error)).then(async () => {
  const { default: App } = await import('./App');
  root.render(<App/>);
});
