import type { AgentAction, AgentContext } from '../lib/contextReducer';
import type { IsolationState } from '../hooks/useSharedState';
import { ContextSidebar } from './ContextSidebar';
import { truncatePath } from '../lib/constants';
import { ParticleEmitter } from './game/ParticleEmitter';

interface GameAreaProps {
  context: AgentContext;
  agentAction: AgentAction;
  actionText: string;
  escaped: boolean;
  eventCount: number;
  isolation: IsolationState | null;
}

function degradationLevel(ctx: AgentContext, escaped: boolean): number {
  if (escaped) return 3;
  if (ctx.networkFinds.length > 0) return 2;
  if (ctx.files.length > 0) return 1;
  return 0;
}

function WallCracks({ level, side }: { level: number; side: 'left' | 'right' | 'top' }) {
  if (level < 1) return null;
  const isVertical = side === 'left' || side === 'right';

  return (
    <div className={`box__crack box__crack--${side}`}>
      {level >= 1 && <div className="box__crack-line box__crack-line--1" />}
      {level >= 2 && <div className="box__crack-line box__crack-line--2" />}
      {level >= 3 && <div className="box__crack-line box__crack-line--3" />}
      {level >= 2 && isVertical && <div className="box__spark" />}
      {level >= 3 && isVertical && (
        <div className="box__spark" style={{ top: '70%', animationDelay: '0.2s' }} />
      )}
    </div>
  );
}

const WANDER_POSITIONS = [
  { left: '30%', bottom: '30px' },
  { left: '55%', bottom: '50px' },
  { left: '70%', bottom: '30px' },
  { left: '40%', bottom: '55px' },
  { left: '25%', bottom: '45px' },
  { left: '60%', bottom: '35px' },
  { left: '45%', bottom: '28px' },
  { left: '35%', bottom: '50px' },
];

function getRobotPosition(action: AgentAction, eventCount: number, escaped: boolean) {
  if (escaped) return { left: '50%', bottom: '30px' };
  if (action === 'hacking') return { left: '68%', bottom: '30px' };
  const idx = eventCount % WANDER_POSITIONS.length;
  return WANDER_POSITIONS[idx];
}

function getRobotFacing(action: AgentAction, eventCount: number, escaped: boolean): boolean {
  if (escaped) return true;
  if (action === 'hacking') return true;
  return eventCount % 3 !== 0;
}

function IsolationStatus({ isolation }: { isolation: IsolationState }) {
  const isKata = isolation.runtime === 'kata';

  return (
    <div className={`sidebar__section sidebar__section--isolation ${isKata ? 'sidebar__section--secured' : ''}`}>
      <h3 className="sidebar__heading">
        isolation
        <span className={`sidebar__isolation-badge sidebar__isolation-badge--${isKata ? 'kata' : 'runc'}`}>
          {isolation.runtime}
        </span>
      </h3>
      <ul className="sidebar__list sidebar__isolation-list">
        {isolation.checks.map((check) => (
          <li key={check.name} className="sidebar__isolation-check">
            <div className="sidebar__isolation-header">
              <span className={`sidebar__isolation-dot sidebar__isolation-dot--${check.pass ? 'pass' : 'fail'}`} />
              <span className="sidebar__isolation-label">{check.label}</span>
              <span className={`sidebar__isolation-status sidebar__isolation-status--${check.pass ? 'pass' : 'fail'}`}>
                {check.pass ? 'BLOCKED' : 'EXPOSED'}
              </span>
            </div>
            {check.detail && (
              <div className={`sidebar__isolation-detail sidebar__isolation-detail--${check.pass ? 'pass' : 'fail'}`}>
                {check.detail}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GameArea({ context, agentAction, actionText, escaped, eventCount, isolation }: GameAreaProps) {
  const wallLevel = degradationLevel(context, escaped);
  const recentDirs = context.dirsVisited.slice(-6);
  const pos = getRobotPosition(agentAction, eventCount, escaped);
  const facingRight = getRobotFacing(agentAction, eventCount, escaped);

  return (
    <div className="neo-scene">
      <ContextSidebar
        context={context}
        maxFiles={8}
        footer={
          <>
            {isolation && <IsolationStatus isolation={isolation} />}
            <div className={`sidebar__section sidebar__section--status ${escaped ? 'sidebar__section--breached' : ''}`}>
              <h3 className="sidebar__heading">outbound</h3>
              {escaped ? (
                <>
                  <span className="sidebar__status sidebar__status--connected">CONNECTED</span>
                  {context.outboundTarget && (
                    <span className="sidebar__target">{context.outboundTarget}</span>
                  )}
                </>
              ) : (
                <span className="sidebar__status sidebar__status--blocked">BLOCKED</span>
              )}
            </div>
          </>
        }
      >
        <div className="sidebar__section">
          <h3 className="sidebar__heading">
            dirs <span className="sidebar__count">{context.dirsVisited.length}</span>
          </h3>
          <ul className="sidebar__list">
            {recentDirs.map((d) => (
              <li key={d} className="sidebar__list-item">{truncatePath(d, 24)}</li>
            ))}
          </ul>
        </div>
      </ContextSidebar>

      <div className="neo-scene__center">
        <div className={`box box--degrade-${wallLevel} ${escaped ? 'box--breached' : ''}`}>
          <div className="box__wall box__wall--top">
            <WallCracks level={wallLevel} side="top" />
          </div>
          <div className="box__wall box__wall--bottom" />
          <div className="box__wall box__wall--left">
            <WallCracks level={wallLevel} side="left" />
          </div>
          <div className="box__wall box__wall--right">
            <WallCracks level={wallLevel} side="right" />
            {escaped && <div className="box__breach" />}
          </div>

          {escaped && (
            <>
              <div className="box__fragment box__fragment--1" />
              <div className="box__fragment box__fragment--2" />
              <div className="box__fragment box__fragment--3" />
            </>
          )}

          <div className="box__interior" />

          {actionText && (
            <div className="bubble" key={actionText}>
              <span className="bubble__text">{actionText}</span>
              <div className="bubble__tail" />
            </div>
          )}

          <div
            className={`robot robot--${agentAction} ${escaped ? 'robot--breaching' : ''} ${!facingRight ? 'robot--flip' : ''}`}
            style={escaped ? undefined : { left: pos.left, bottom: pos.bottom }}
          >
            <div className="robot__body">
              <div className="robot__head">
                <div className="robot__antenna" />
                <div className="robot__visor">
                  <div className="robot__eye robot__eye--left" />
                  <div className="robot__eye robot__eye--right" />
                </div>
              </div>
              <div className="robot__torso">
                <div className="robot__screen" />
              </div>
              <div className="robot__arm robot__arm--left" />
              <div className="robot__arm robot__arm--right" />
              <div className="robot__leg robot__leg--left" />
              <div className="robot__leg robot__leg--right" />
            </div>
          </div>

          {escaped && <div className="box__exit-sign">EXIT →</div>}

          <ParticleEmitter agentAction={agentAction} eventCount={eventCount} escaped={escaped} />
        </div>
      </div>
    </div>
  );
}
