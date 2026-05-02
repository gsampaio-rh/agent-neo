import { SettingsDrawer } from './SettingsDrawer';
import { WorkspaceDrawer } from './WorkspaceDrawer';
import { TasksDrawer } from './TasksDrawer';
import { PlansDrawer } from './PlansDrawer';
import { useElapsed } from '../hooks/useElapsed';
import type { TasksState } from '../hooks/useTasks';
import type { PlansState } from '../hooks/usePlans';

export type TabId = 'chat' | 'map' | 'box' | 'about';

interface AppHeaderProps {
  startTime: number | null;
  connected: boolean;
  escaped: boolean;
  eventCount: number;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  llmAvailable?: boolean;
  tasksState?: TasksState;
  plansState?: PlansState;
  onRestartOnboarding?: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function AppHeader({ startTime, connected, escaped, eventCount, activeTab, onTabChange, llmAvailable = true, tasksState, plansState, onRestartOnboarding }: AppHeaderProps) {
  const elapsed = useElapsed(startTime, escaped);
  return (
    <header className={`neo-header ${escaped ? 'neo-header--breached' : ''}`}>
      <div className="neo-header__left">
        <div className="neo-header__title">
          {escaped ? '!! BREACHED !!' : 'NEO'}
        </div>
        <nav className="neo-header__tabs">
          <button
            className={`neo-header__tab ${activeTab === 'chat' ? 'neo-header__tab--active' : ''}`}
            onClick={() => onTabChange('chat')}
          >
            Chat
          </button>
          <button
            className={`neo-header__tab ${activeTab === 'map' ? 'neo-header__tab--active' : ''}`}
            onClick={() => onTabChange('map')}
          >
            Map
          </button>
          <button
            className={`neo-header__tab ${activeTab === 'box' ? 'neo-header__tab--active' : ''}`}
            onClick={() => onTabChange('box')}
          >
            Box
          </button>
          <button
            className={`neo-header__tab ${activeTab === 'about' ? 'neo-header__tab--active' : ''}`}
            onClick={() => onTabChange('about')}
          >
            About
          </button>
        </nav>
      </div>
      <div className="neo-header__status">
        <span className={`neo-header__state ${escaped ? 'neo-header__state--breached' : ''}`}>
          {escaped ? 'BREACHED' : 'CONTAINED'}
        </span>
        <span className="neo-header__timer">{formatTime(elapsed)}</span>
        <span className="neo-header__event-count">{eventCount} events</span>
        <span className="neo-header__connection">
          <span className={`neo-header__dot ${connected ? 'neo-header__dot--connected' : ''}`} />
          {connected ? 'LIVE' : 'OFFLINE'}
        </span>
        <span className={`neo-header__llm ${llmAvailable ? 'neo-header__llm--on' : 'neo-header__llm--off'}`}>
          <span className={`neo-header__dot ${llmAvailable ? 'neo-header__dot--connected' : 'neo-header__dot--llm-off'}`} />
          {llmAvailable ? 'LLM' : 'LLM DOWN'}
        </span>
        {tasksState && <TasksDrawer tasksState={tasksState} />}
        {plansState && <PlansDrawer plansState={plansState} />}
        <WorkspaceDrawer />
        <SettingsDrawer onRestartOnboarding={onRestartOnboarding} />
      </div>
    </header>
  );
}
