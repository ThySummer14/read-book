import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { BoxedList, SettingLabel, SettingsSwitchRow } from '@/components/settings/primitives';
import { defaultCodexCliPath } from '../adapters/codexLaunch';
import { normalizeClaudianSettings } from '../ported/core/defaultSettings';
import type {
  ClaudianReasoningEffort,
  ClaudianSafeMode,
  ClaudianSettings,
} from '../ported/core/types';

const ClaudianSettingsSection: React.FC = () => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { settings, setSettings, saveSettings } = useSettingsStore();
  const claudianSettings = normalizeClaudianSettings(settings?.claudianSettings);
  const settingsRef = useRef(settings);
  const isMounted = useRef(false);

  const [enabled, setEnabled] = useState(claudianSettings.enabled);
  const [codexCliPath, setCodexCliPath] = useState(claudianSettings.codexCliPath);
  const [model, setModel] = useState(claudianSettings.model);
  const [safeMode, setSafeMode] = useState<ClaudianSafeMode>(claudianSettings.safeMode);
  const [reasoningEffort, setReasoningEffort] = useState<ClaudianReasoningEffort>(
    claudianSettings.reasoningEffort,
  );
  const [autoScroll, setAutoScroll] = useState(claudianSettings.autoScroll);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    isMounted.current = true;
  }, []);

  const saveClaudianSetting = useCallback(
    async <K extends keyof ClaudianSettings>(key: K, value: ClaudianSettings[K]) => {
      const currentSettings = settingsRef.current;
      if (!currentSettings) return;
      const nextClaudianSettings: ClaudianSettings = {
        ...normalizeClaudianSettings(currentSettings.claudianSettings),
        [key]: value,
      };
      const nextSettings = { ...currentSettings, claudianSettings: nextClaudianSettings };

      setSettings(nextSettings);
      await saveSettings(envConfig, nextSettings);
    },
    [envConfig, saveSettings, setSettings],
  );

  const syncSetting = useCallback(
    <K extends keyof ClaudianSettings>(key: K, value: ClaudianSettings[K]) => {
      if (!isMounted.current || value === claudianSettings[key]) return;
      void saveClaudianSetting(key, value);
    },
    [claudianSettings, saveClaudianSetting],
  );

  useEffect(() => syncSetting('enabled', enabled), [enabled, syncSetting]);
  useEffect(() => syncSetting('codexCliPath', codexCliPath), [codexCliPath, syncSetting]);
  useEffect(() => syncSetting('model', model), [model, syncSetting]);
  useEffect(() => syncSetting('safeMode', safeMode), [safeMode, syncSetting]);
  useEffect(() => syncSetting('reasoningEffort', reasoningEffort), [reasoningEffort, syncSetting]);
  useEffect(() => syncSetting('autoScroll', autoScroll), [autoScroll, syncSetting]);

  return (
    <BoxedList
      title='Claudian'
      description={_('Codex-powered reading assistant in a separate sidebar.')}
    >
      <SettingsSwitchRow
        label={_('Enable Claudian')}
        checked={enabled}
        onChange={() => setEnabled(!enabled)}
      />
      <div className='flex flex-col gap-2 px-4 py-3'>
        <SettingLabel>{_('Codex CLI Path')}</SettingLabel>
        <input
          type='text'
          className='input input-bordered input-sm w-full'
          value={codexCliPath}
          onChange={(event) => setCodexCliPath(event.target.value)}
          placeholder={defaultCodexCliPath()}
          disabled={!enabled}
        />
        <p className='text-base-content/60 text-xs'>
          {_('Leave empty to auto-detect Codex. On macOS this uses Codex.app by default.')}
        </p>
      </div>
      <div className='flex flex-col gap-2 px-4 py-3'>
        <SettingLabel>{_('Model')}</SettingLabel>
        <input
          type='text'
          className='input input-bordered input-sm w-full'
          value={model}
          onChange={(event) => setModel(event.target.value)}
          placeholder='gpt-5.2'
          disabled={!enabled}
        />
      </div>
      <div className='flex flex-col gap-2 px-4 py-3'>
        <SettingLabel>{_('Safe Mode')}</SettingLabel>
        <select
          className='select select-bordered select-sm bg-base-100 text-base-content w-full'
          value={safeMode}
          onChange={(event) => setSafeMode(event.target.value as ClaudianSafeMode)}
          disabled={!enabled}
        >
          <option value='read-only'>{_('Read only')}</option>
          <option value='workspace-write'>{_('Workspace write')}</option>
          <option value='danger-full-access'>{_('Danger full access')}</option>
        </select>
      </div>
      <div className='flex flex-col gap-2 px-4 py-3'>
        <SettingLabel>{_('Reasoning Effort')}</SettingLabel>
        <select
          className='select select-bordered select-sm bg-base-100 text-base-content w-full'
          value={reasoningEffort}
          onChange={(event) => setReasoningEffort(event.target.value as ClaudianReasoningEffort)}
          disabled={!enabled}
        >
          <option value='low'>{_('Low')}</option>
          <option value='medium'>{_('Medium')}</option>
          <option value='high'>{_('High')}</option>
          <option value='xhigh'>{_('Extra high')}</option>
        </select>
      </div>
      <SettingsSwitchRow
        label={_('Auto-scroll Claudian responses')}
        checked={autoScroll}
        onChange={() => setAutoScroll(!autoScroll)}
      />
    </BoxedList>
  );
};

export default ClaudianSettingsSection;
