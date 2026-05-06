import React from 'react';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Sun, Volume2, RotateCcw, Sparkles, Square, Moon, Clock, RefreshCw, CheckCircle2, ArrowUpCircle, ChevronDown, ChevronUp, Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { useTodo } from '@/contexts/TodoContext';
import { updateSettings } from '@/utils/storage';
import { useDarkMode } from '@/contexts/DarkModeContext';
import { getVersion } from '@tauri-apps/api/app';
import { check, type Update, type DownloadEvent } from '@tauri-apps/plugin-updater';
import { invoke } from '@tauri-apps/api/core';
import CategoryModal from '@/components/CategoryModal';
import type { Category } from '@/types/todo';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface SettingsPageProps {
  onPageChange?: (page: 'dashboard' | 'tasks' | 'reminders' | 'events' | 'notifications' | 'pomodoro' | 'notes' | 'activity' | 'timetracking' | 'settings' | 'espy' | 'schedule') => void;
  theme?: 'clean' | 'retro';
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onPageChange, theme = 'clean' }) => {
  const { userData, addCategory, updateCategory, deleteCategory } = useTodo();
  const { themeMode, setThemeMode } = useDarkMode();
  const [pomodoroSound, setPomodoroSound] = React.useState(
    userData.settings.pomodoroSound !== undefined ? userData.settings.pomodoroSound : true
  );
  const [selectedTheme, setSelectedTheme] = React.useState<'clean' | 'retro'>(
    userData.settings.theme || 'clean'
  );
  const [workDuration, setWorkDuration] = React.useState(userData.settings.workDuration || 25);
  const [shortBreakDuration, setShortBreakDuration] = React.useState(userData.settings.shortBreakDuration || 5);

  // Category management state
  const [categoryModalOpen, setCategoryModalOpen] = React.useState(false);
  const [categoryModalMode, setCategoryModalMode] = React.useState<'create' | 'edit'>('create');
  const [editingCategory, setEditingCategory] = React.useState<Category | undefined>(undefined);
  const [deletingCategory, setDeletingCategory] = React.useState<Category | null>(null);

  const handleOpenCreateCategory = () => {
    setCategoryModalMode('create');
    setEditingCategory(undefined);
    setCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: Category) => {
    setCategoryModalMode('edit');
    setEditingCategory(cat);
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = (name: string, color: string, icon: string) => {
    if (categoryModalMode === 'create') {
      addCategory(name, color, icon);
    } else if (editingCategory) {
      updateCategory(editingCategory.id, { name, color, icon });
    }
  };

  const handleDeleteCategory = (cat: Category) => {
    setDeletingCategory(cat);
  };

  const confirmDeleteCategory = () => {
    if (deletingCategory) {
      deleteCategory(deletingCategory.id);
      setDeletingCategory(null);
    }
  };

  // Updates state
  const [currentVersion, setCurrentVersion] = React.useState<string>('');
  const [availableUpdate, setAvailableUpdate] = React.useState<Update | null>(null);
  const [updateChecked, setUpdateChecked] = React.useState(false);
  const [checkingUpdate, setCheckingUpdate] = React.useState(false);
  const [installing, setInstalling] = React.useState(false);
  const [installProgress, setInstallProgress] = React.useState(0);
  const [showUpdateNotes, setShowUpdateNotes] = React.useState(false);

  React.useEffect(() => {
    getVersion().then(setCurrentVersion).catch(() => {});
  }, []);

  const handleCheckUpdates = async () => {
    setCheckingUpdate(true);
    setUpdateChecked(false);
    try {
      const u = await check();
      setAvailableUpdate(u);
      setUpdateChecked(true);
      if (u) {
        localStorage.removeItem('espy_dismissed_update_version');
      }
    } catch {
      setUpdateChecked(true);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleInstallFromSettings = async () => {
    if (!availableUpdate) return;
    setInstalling(true);
    let downloaded = 0;
    let total = 0;
    await availableUpdate.downloadAndInstall((event: DownloadEvent) => {
      if (event.event === 'Started') total = event.data.contentLength ?? 0;
      else if (event.event === 'Progress') {
        downloaded += event.data.chunkLength;
        if (total > 0) setInstallProgress(Math.round((downloaded / total) * 100));
      }
    });
    await invoke('restart_app');
  };

  const handlePomodoroSoundChange = (enabled: boolean) => {
    setPomodoroSound(enabled);
    updateSettings({ pomodoroSound: enabled });
  };

  const handleWorkDurationChange = (value: number) => {
    setWorkDuration(value);
    updateSettings({ workDuration: value });
  };

  const handleShortBreakDurationChange = (value: number) => {
    setShortBreakDuration(value);
    updateSettings({ shortBreakDuration: value });
  };

  const handleResetOnboarding = () => {
    if (window.confirm('This will show the onboarding flow again. Continue?')) {
      // Set force show flag to bypass task check
      localStorage.setItem('espy_onboarding_force_show', 'true');
      // Also remove completion flag
      localStorage.removeItem('espy_onboarding_completed');
      window.location.reload();
    }
  };

  const handleThemeChange = (theme: 'clean' | 'retro') => {
    setSelectedTheme(theme);
    updateSettings({ theme });
    // Reload page to apply the new theme
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className={
        theme === 'retro'
          ? "bg-card border-b-4 border-black dark:border-white"
          : "bg-card border-b"
      }>
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={
                theme === 'retro'
                  ? "text-3xl font-black text-foreground"
                  : "text-2xl font-bold text-foreground"
              }>
                ⚙️ Settings
              </h1>
              <p className={
                theme === 'retro'
                  ? "text-muted-foreground font-medium mt-1"
                  : "text-muted-foreground mt-1"
              }>
                Customize your Espy experience
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-6">
          
          {/* Appearance Section */}
          <Card className={
            theme === 'retro'
              ? "bg-[#fff3b0]/30 dark:bg-[#ffd700]/10 border-2 border-black dark:border-white rounded-2xl shadow-[4px_4px_0_0_rgba(0,0,0,0.3)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,0.1)]"
              : ""
          }>
            <CardHeader>
              <CardTitle className={theme === 'retro' ? "flex items-center gap-2 font-bold text-foreground" : "flex items-center gap-2"}>
                <Sun className="h-5 w-5" />
                Appearance
              </CardTitle>
              <CardDescription className={theme === 'retro' ? "text-muted-foreground font-medium" : ""}>
                Customize how Espy looks and feels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Design Style - Primary Choice */}
              <div className="space-y-3 p-4 bg-primary/5 rounded-lg border-2 border-primary/20">
                <div>
                  <label className={
                    theme === 'retro'
                      ? "text-lg font-black text-primary"
                      : "text-base font-bold text-primary"
                  }>
                    Design Style
                  </label>
                  <p className={
                    theme === 'retro'
                      ? "text-xs text-muted-foreground font-medium mt-1"
                      : "text-xs text-muted-foreground mt-1"
                  }>
                    Completely changes how Espy looks and feels
                  </p>
                </div>
                <div className="flex gap-3">
                  {/* Clean Button - Styled like Clean UI */}
                  <Button
                    variant="outline"
                    size={theme === 'retro' ? 'lg' : 'default'}
                    onClick={() => handleThemeChange('clean')}
                    className={
                      selectedTheme === 'clean'
                        ? `flex-1 font-semibold border-2 ring-4 ring-blue-500/30 shadow-lg bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-blue-500 text-blue-700 dark:text-blue-300 hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-900/40 dark:hover:to-purple-900/40`
                        : `flex-1 font-semibold hover:border-blue-300 hover:shadow-md`
                    }
                  >
                    <Sparkles className="h-5 w-5 mr-2" />
                    Clean
                  </Button>
                  
                  {/* Retro Button - Styled like Retro UI */}
                  <Button
                    variant="outline"
                    size={theme === 'retro' ? 'lg' : 'default'}
                    onClick={() => handleThemeChange('retro')}
                    className={
                      selectedTheme === 'retro'
                        ? `flex-1 font-black border-4 border-black dark:border-white shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:shadow-[6px_6px_0_0_rgba(255,255,255,0.3)] bg-yellow-100 dark:bg-yellow-900/30 text-black dark:text-white hover:shadow-[8px_8px_0_0_rgba(0,0,0,1)] dark:hover:shadow-[8px_8px_0_0_rgba(255,255,255,0.4)] translate-x-[-2px] translate-y-[-2px]`
                        : `flex-1 font-black border-2 hover:border-black dark:hover:border-white hover:shadow-[4px_4px_0_0_rgba(0,0,0,0.5)] dark:hover:shadow-[4px_4px_0_0_rgba(255,255,255,0.2)]`
                    }
                  >
                    <Square className="h-5 w-5 mr-2 fill-current" />
                    Retro
                  </Button>
                </div>
              </div>
              
              <Separator />
              
              {/* Color Mode - Secondary Choice */}
              <div className="space-y-3">
                <div className="space-y-0.5">
                  <label className={
                    theme === 'retro'
                      ? "text-base font-bold"
                      : "text-sm font-medium"
                  }>
                    Color Mode
                  </label>
                  <p className={
                    theme === 'retro'
                      ? "text-xs text-muted-foreground font-medium"
                      : "text-xs text-muted-foreground"
                  }>
                    Light, dark, or automatic theme switching
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={themeMode === 'light' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setThemeMode('light')}
                    className={
                      theme === 'retro'
                        ? "flex-1 font-bold border-2"
                        : "flex-1"
                    }
                  >
                    <Sun className="h-4 w-4 mr-1.5" />
                    Light
                  </Button>
                  <Button
                    variant={themeMode === 'dark' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setThemeMode('dark')}
                    className={
                      theme === 'retro'
                        ? "flex-1 font-bold border-2"
                        : "flex-1"
                    }
                  >
                    <Moon className="h-4 w-4 mr-1.5" />
                    Dark
                  </Button>
                  <Button
                    variant={themeMode === 'auto' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setThemeMode('auto')}
                    className={
                      theme === 'retro'
                        ? "flex-1 font-bold border-2 relative"
                        : "flex-1 relative"
                    }
                  >
                    <Clock className="h-4 w-4 mr-1.5" />
                    Auto
                    {themeMode === 'auto' && (
                      <span className="ml-1 text-xs">★</span>
                    )}
                  </Button>
                </div>
                {themeMode === 'auto' && (
                  <p className={
                    theme === 'retro'
                      ? "text-xs text-muted-foreground font-medium italic"
                      : "text-xs text-muted-foreground italic"
                  }>
                    Dark mode from 6 PM to 6 AM
                  </p>
                )}
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className={
                    theme === 'retro'
                      ? "text-base font-bold"
                      : "text-sm font-medium"
                  }>
                    Welcome Tour
                  </label>
                  <p className={
                    theme === 'retro'
                      ? "text-sm text-muted-foreground font-medium"
                      : "text-sm text-muted-foreground"
                  }>
                    Replay the onboarding experience
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size={theme === 'retro' ? 'default' : 'sm'}
                  onClick={handleResetOnboarding}
                  className={
                    theme === 'retro'
                      ? "font-bold border-2 shadow-[2px_2px_0_0_rgba(0,0,0,0.3)] dark:shadow-[2px_2px_0_0_rgba(255,255,255,0.1)]"
                      : ""
                  }
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restart Tour
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Pomodoro Section */}
          <Card className={
            theme === 'retro'
              ? "bg-[#d4f1ff]/30 dark:bg-[#00d4ff]/10 border-2 border-black dark:border-white rounded-2xl shadow-[4px_4px_0_0_rgba(0,0,0,0.3)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,0.1)]"
              : ""
          }>
            <CardHeader>
              <CardTitle className={theme === 'retro' ? "flex items-center gap-2 font-bold text-foreground" : "flex items-center gap-2"}>
                <Volume2 className="h-5 w-5" />
                Pomodoro
              </CardTitle>
              <CardDescription className={theme === 'retro' ? "text-muted-foreground font-medium" : ""}>
                Configure pomodoro timer settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className={
                    theme === 'retro'
                      ? "text-base font-bold cursor-pointer"
                      : "text-sm font-medium cursor-pointer"
                  }>
                    Sound Alerts
                  </label>
                  <p className={
                    theme === 'retro'
                      ? "text-sm text-muted-foreground font-medium"
                      : "text-sm text-muted-foreground"
                  }>
                    Play sound when pomodoro timer ends
                  </p>
                </div>
                <ToggleSwitch
                  checked={pomodoroSound}
                  onCheckedChange={handlePomodoroSoundChange}
                  size="md"
                />
              </div>

              <Separator />

              {/* Work Duration */}
              <div className="space-y-3">
                <div className="space-y-0.5">
                  <label className={
                    theme === 'retro'
                      ? "text-base font-bold"
                      : "text-sm font-medium"
                  }>
                    Work Duration
                  </label>
                  <p className={
                    theme === 'retro'
                      ? "text-sm text-muted-foreground font-medium"
                      : "text-sm text-muted-foreground"
                  }>
                    Length of focus sessions in minutes
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="60"
                    step="1"
                    value={workDuration}
                    onChange={(e) => handleWorkDurationChange(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className={
                    theme === 'retro'
                      ? "min-w-[80px] text-center px-3 py-2 bg-primary/10 border-2 border-black dark:border-white rounded-lg font-black text-lg"
                      : "min-w-[80px] text-center px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg font-semibold"
                  }>
                    {workDuration} min
                  </div>
                </div>
              </div>

              {/* Break Duration */}
              <div className="space-y-3">
                <div className="space-y-0.5">
                  <label className={
                    theme === 'retro'
                      ? "text-base font-bold"
                      : "text-sm font-medium"
                  }>
                    Break Duration
                  </label>
                  <p className={
                    theme === 'retro'
                      ? "text-sm text-muted-foreground font-medium"
                      : "text-sm text-muted-foreground"
                  }>
                    Length of breaks between focus sessions
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="30"
                    step="1"
                    value={shortBreakDuration}
                    onChange={(e) => handleShortBreakDurationChange(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className={
                    theme === 'retro'
                      ? "min-w-[80px] text-center px-3 py-2 bg-primary/10 border-2 border-black dark:border-white rounded-lg font-black text-lg"
                      : "min-w-[80px] text-center px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg font-semibold"
                  }>
                    {shortBreakDuration} min
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Categories Section */}
          <Card className={
            theme === 'retro'
              ? "bg-[#e8f0ff]/30 dark:bg-[#6366f1]/10 border-2 border-black dark:border-white rounded-2xl shadow-[4px_4px_0_0_rgba(0,0,0,0.3)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,0.1)]"
              : ""
          }>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className={theme === 'retro' ? "flex items-center gap-2 font-bold text-foreground" : "flex items-center gap-2"}>
                    <Tag className="h-5 w-5" />
                    Categories
                  </CardTitle>
                  <CardDescription className={theme === 'retro' ? "text-muted-foreground font-medium mt-1" : "mt-1"}>
                    Manage your task and schedule categories
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={handleOpenCreateCategory}
                  className={
                    theme === 'retro'
                      ? "font-bold border-2 border-black dark:border-white shadow-[2px_2px_0_0_rgba(0,0,0,0.3)] dark:shadow-[2px_2px_0_0_rgba(255,255,255,0.1)]"
                      : ""
                  }
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New Category
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {userData.categories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No categories yet. Create one to get started!
                </p>
              ) : (
                <div className="space-y-2">
                  {userData.categories.map((cat) => (
                    <div
                      key={cat.id}
                      className={
                        theme === 'retro'
                          ? "flex items-center justify-between p-3 rounded-xl border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-800 shadow-[2px_2px_0_0_rgba(0,0,0,0.15)]"
                          : "flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                      }
                    >
                      <div className="flex items-center gap-3">
                        {/* Color dot */}
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        {/* Icon + name */}
                        <span className="text-lg leading-none">{cat.icon}</span>
                        <span className={theme === 'retro' ? "font-bold text-foreground" : "text-sm font-medium text-foreground"}>
                          {cat.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditCategory(cat)}
                          className={
                            theme === 'retro'
                              ? "h-8 w-8 p-0 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                              : "h-8 w-8 p-0"
                          }
                          title="Edit category"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCategory(cat)}
                          className={
                            theme === 'retro'
                              ? "h-8 w-8 p-0 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 rounded-lg"
                              : "h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          }
                          title="Delete category"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Updates Section */}
          <Card className={
            theme === 'retro'
              ? "bg-[#e8f5e9]/30 dark:bg-[#4caf50]/10 border-2 border-black dark:border-white rounded-2xl shadow-[4px_4px_0_0_rgba(0,0,0,0.3)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,0.1)]"
              : ""
          }>
            <CardHeader>
              <CardTitle className={theme === 'retro' ? "flex items-center gap-2 font-bold text-foreground" : "flex items-center gap-2"}>
                <ArrowUpCircle className="h-5 w-5" />
                Updates
              </CardTitle>
              <CardDescription className={theme === 'retro' ? "text-muted-foreground font-medium" : ""}>
                Keep Espy up to date
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current version */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className={theme === 'retro' ? "text-base font-bold" : "text-sm font-medium"}>
                    Installed version
                  </p>
                  <p className={theme === 'retro' ? "text-sm text-muted-foreground font-medium" : "text-sm text-muted-foreground"}>
                    {currentVersion ? `v${currentVersion}` : 'Loading...'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size={theme === 'retro' ? 'default' : 'sm'}
                  onClick={handleCheckUpdates}
                  disabled={checkingUpdate || installing}
                  className={theme === 'retro' ? "font-bold border-2 shadow-[2px_2px_0_0_rgba(0,0,0,0.3)] dark:shadow-[2px_2px_0_0_rgba(255,255,255,0.1)]" : ""}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${checkingUpdate ? 'animate-spin' : ''}`} />
                  {checkingUpdate ? 'Checking...' : 'Check for updates'}
                </Button>
              </div>

              {/* Result after checking */}
              {updateChecked && (
                <>
                  <Separator />
                  {availableUpdate ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={theme === 'retro' ? "text-base font-bold text-primary" : "text-sm font-semibold text-primary"}>
                            v{availableUpdate.version} available
                          </p>
                          <p className={theme === 'retro' ? "text-xs text-muted-foreground font-medium" : "text-xs text-muted-foreground"}>
                            You have v{currentVersion} installed
                          </p>
                        </div>
                        {!installing && (
                          <Button
                            size={theme === 'retro' ? 'default' : 'sm'}
                            onClick={handleInstallFromSettings}
                            className={theme === 'retro' ? "font-bold" : ""}
                          >
                            Install now
                          </Button>
                        )}
                      </div>

                      {installing && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{installProgress < 100 ? 'Downloading...' : 'Installing...'}</span>
                            <span>{installProgress}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all duration-200 rounded-full"
                              style={{ width: `${installProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {availableUpdate.body && (
                        <div className="rounded-md border bg-muted/40 overflow-hidden">
                          <button
                            onClick={() => setShowUpdateNotes((s) => !s)}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/60 transition-colors"
                          >
                            What's new in v{availableUpdate.version}
                            {showUpdateNotes ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                          {showUpdateNotes && (
                            <div className="px-3 pb-3 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed border-t">
                              {availableUpdate.body}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <span>
                        You're on the latest version{currentVersion ? ` (v${currentVersion})` : ''}.
                      </span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Category Create/Edit Modal */}
      <CategoryModal
        open={categoryModalOpen}
        onOpenChange={setCategoryModalOpen}
        mode={categoryModalMode}
        category={editingCategory}
        theme={theme}
        onSave={handleSaveCategory}
        defaultColorIndex={userData.categories.length}
      />

      {/* Delete Category Confirmation */}
      <Dialog open={!!deletingCategory} onOpenChange={() => setDeletingCategory(null)}>
        <DialogContent className={
          theme === 'retro'
            ? "sm:max-w-[400px] bg-white dark:bg-gray-900 border-2 border-black dark:border-white rounded-2xl shadow-[8px_8px_0_0_rgba(0,0,0,0.3)] dark:shadow-[8px_8px_0_0_rgba(255,255,255,0.2)]"
            : "sm:max-w-[400px]"
        }>
          <DialogHeader>
            <DialogTitle className={theme === 'retro' ? "text-xl font-black text-red-600 dark:text-red-400 flex items-center gap-2" : "text-xl font-semibold text-red-600 dark:text-red-400"}>
              {theme === 'retro' && <Trash2 className="w-5 h-5" />}
              Delete Category?
            </DialogTitle>
          </DialogHeader>
          <div className="pt-2 space-y-4">
            <p className={theme === 'retro' ? "text-sm font-medium text-gray-700 dark:text-gray-300" : "text-sm text-muted-foreground"}>
              Are you sure you want to delete{' '}
              <span className="font-semibold text-foreground">
                {deletingCategory?.icon} {deletingCategory?.name}
              </span>
              ? Tasks in this category will remain but become uncategorized.
            </p>
            <div className="flex gap-3">
              <Button
                variant="destructive"
                onClick={confirmDeleteCategory}
                className={
                  theme === 'retro'
                    ? "flex-1 font-black border-2 border-black dark:border-red-400 shadow-[3px_3px_0_0_rgba(0,0,0,0.3)] h-10"
                    : "flex-1"
                }
              >
                Delete
              </Button>
              <Button
                variant="outline"
                onClick={() => setDeletingCategory(null)}
                className={
                  theme === 'retro'
                    ? "flex-1 font-bold border-2 border-black dark:border-white h-10"
                    : "flex-1"
                }
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;