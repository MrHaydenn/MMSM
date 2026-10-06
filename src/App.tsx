import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ServerProvider, useServer } from './context/ServerContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { MainDashboard } from './components/dashboard/MainDashboard';
import { ConsoleView } from './components/dashboard/ConsoleView';
import { MetricsView } from './components/dashboard/MetricsView';
import { ModrinthManager } from './components/modrinth/ModrinthManager';
import { FileManager } from './components/files/FileManager';
import { PlayerManager } from './components/players/PlayerManager';
import { BackupManager } from './components/backups/BackupManager';
import { SchedulingPage } from './components/scheduling/SchedulingPage';
import { AnalyticsPage } from './components/analytics/AnalyticsPage';
import { ConfigEditor } from './components/config/ConfigEditor';
import { LoaderCorePage } from './components/updates/LoaderCorePage';
import { UserManagementView } from './components/users/UserManagementView';
import { CreateServerWizard } from './components/servers/CreateServerWizard';
import { LoaderUpdateModal } from './components/updates/LoaderUpdateModal';
import { WrapperSettingsModal } from './components/settings/WrapperSettingsModal';
import { AccountProfileModal } from './components/auth/AccountProfileModal';
import { LoginPage } from './components/auth/LoginPage';
import { MinecraftServer, ModrinthSearchResult } from './types/server';

const MainLayout: React.FC = () => {
  const { currentUser } = useAuth();
  const { activeServer, setActiveServerId } = useServer();

  // Control whether the user is on the Main Fleet Dashboard or managing an individual server
  const [selectedServerView, setSelectedServerView] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('console');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Modals
  const [isCreateWizardOpen, setIsCreateWizardOpen] = useState(false);
  const [isLoaderUpdateOpen, setIsLoaderUpdateOpen] = useState(false);
  const [isWrapperSettingsOpen, setIsWrapperSettingsOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [targetUpdateServer, setTargetUpdateServer] = useState<MinecraftServer | undefined>(undefined);
  const [wizardInitialModpack, setWizardInitialModpack] = useState<ModrinthSearchResult | null>(null);

  // If not authenticated, show login page
  if (!currentUser) {
    return <LoginPage />;
  }

  const handleOpenLoaderUpdate = (server?: MinecraftServer) => {
    setTargetUpdateServer(server || activeServer);
    setIsLoaderUpdateOpen(true);
  };

  const handleDeployModpackAsServer = (modpack: ModrinthSearchResult) => {
    setWizardInitialModpack(modpack);
    setIsCreateWizardOpen(true);
  };

  const handleSelectServerToManage = (server: MinecraftServer) => {
    setActiveServerId(server.id);
    setSelectedServerView(true);
    setActiveTab('console');
  };

  const handleReturnToDashboard = () => {
    setSelectedServerView(false);
  };

  return (
    <div className="min-h-screen bg-[#090c10] text-zinc-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        isServerSelected={selectedServerView}
        onNavigateToDashboard={handleReturnToDashboard}
        onOpenCreateModal={() => {
          setWizardInitialModpack(null);
          setIsCreateWizardOpen(true);
        }}
        onOpenLoaderUpdate={() => handleOpenLoaderUpdate()}
        onSelectServerFromNav={(serverId) => {
          setActiveServerId(serverId);
          setSelectedServerView(true);
        }}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
        onOpenWrapperSettings={() => setIsWrapperSettingsOpen(true)}
      />

      {/* Main Viewport */}
      {!selectedServerView ? (
        // DASHBOARD VIEW: Overall usage + fleet servers cards
        <main className="flex-1 overflow-y-auto bg-[#0a0d12]">
          <MainDashboard
            onSelectServer={handleSelectServerToManage}
            onOpenCreateModal={() => {
              setWizardInitialModpack(null);
              setIsCreateWizardOpen(true);
            }}
            onOpenLoaderUpdate={(srv) => handleOpenLoaderUpdate(srv)}
          />
        </main>
      ) : (
        // INDIVIDUAL SERVER VIEW: Sidebar with all server-specific controls
        <div className="flex-1 flex overflow-hidden">
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onBackToDashboard={handleReturnToDashboard}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />

          <main className="flex-1 overflow-y-auto bg-[#0a0d12]">
            {activeTab === 'console' && <ConsoleView />}
            {activeTab === 'mods' && (
              <ModrinthManager
                onOpenCreateServerWithModpack={handleDeployModpackAsServer}
              />
            )}
            {activeTab === 'metrics' && <MetricsView />}
            {activeTab === 'analytics' && <AnalyticsPage />}
            {activeTab === 'files' && <FileManager />}
            {activeTab === 'players' && <PlayerManager />}
            {activeTab === 'updates' && <LoaderCorePage />}
            {activeTab === 'backups' && <BackupManager />}
            {activeTab === 'scheduling' && <SchedulingPage />}
            {activeTab === 'config' && <ConfigEditor />}
            {activeTab === 'users' && <UserManagementView />}
          </main>
        </div>
      )}

      {/* Global Modals */}
      <CreateServerWizard
        isOpen={isCreateWizardOpen}
        onClose={() => {
          setIsCreateWizardOpen(false);
          setWizardInitialModpack(null);
        }}
        initialModpack={wizardInitialModpack}
      />

      <LoaderUpdateModal
        isOpen={isLoaderUpdateOpen}
        onClose={() => {
          setIsLoaderUpdateOpen(false);
          setTargetUpdateServer(undefined);
        }}
        targetServer={targetUpdateServer}
      />

      <WrapperSettingsModal
        isOpen={isWrapperSettingsOpen}
        onClose={() => setIsWrapperSettingsOpen(false)}
      />

      <AccountProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ServerProvider>
        <MainLayout />
      </ServerProvider>
    </AuthProvider>
  );
}
