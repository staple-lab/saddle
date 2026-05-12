import { useState } from 'react';
import { TokensView } from '../views/TokensView';
import { Sidebar, type AppView, type TokenGroup } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import type { ProjectStructure } from '../types/component';

const mockProject: ProjectStructure = {
  rootPath: '/demo',
  components: [],
  blocks: [],
};

export function DemoApp() {
  const [view, setView] = useState<AppView>('tokens');
  const [tokenGroup, setTokenGroup] = useState<TokenGroup>('colors');

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-stage)',
      overflow: 'hidden',
    }}>
      <TopBar
        view={view}
        showBlocks={false}
        onSelectSection={(section) => setView(section)}
        onOpenSettings={() => setView('settings')}
      />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {view === 'tokens' && (
          <Sidebar
            project={mockProject}
            view={view}
            onViewChange={setView}
            tokenGroup={tokenGroup}
            onTokenGroupChange={setTokenGroup}
          />
        )}
        <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>
          {view === 'tokens' ? (
            <TokensView groupFilter={tokenGroup} />
          ) : (
            <DemoEmpty
              title={view === 'components' ? 'Components' : view === 'settings' ? 'Settings' : 'Saddle'}
              message="This is a live demo of the Tokens experience. Download Saddle to load real components from your project."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DemoEmpty({ title, message }: { title: string; message: string }) {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-stage)', padding: 32,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 600, color: 'var(--color-fg)' }}>{title}</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-fg-muted)', lineHeight: 1.55 }}>{message}</p>
      </div>
    </div>
  );
}
