import React, { useState, useEffect } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { RefreshCw, Download, CheckCircle, AlertTriangle } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from '@/components/ui/button';

import pkg from '../../package.json';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  autoCheckOnMount?: boolean;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  autoCheckOnMount = false
}) => {
  const [checking, setChecking] = useState<boolean>(false);
  const [updateAvailable, setUpdateAvailable] = useState<Update | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [upToDate, setUpToDate] = useState<boolean>(false);

  const performCheck = async () => {
    setChecking(true);
    setErrorMsg('');
    setUpToDate(false);
    try {
      const update = await check();
      if (update) {
        setUpdateAvailable(update);
      } else {
        setUpToDate(true);
      }
    } catch (err: any) {
      console.error('Check update error:', err);
      setErrorMsg(err.message || '远程更新服务器无回应或尚未发布升级包清单');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (isOpen || autoCheckOnMount) {
      performCheck();
    }
  }, [isOpen]);

  const handleStartUpdate = async () => {
    if (!updateAvailable) return;
    setDownloading(true);
    setProgress(0);
    setErrorMsg('');

    try {
      let downloaded = 0;
      let total = 0;

      await updateAvailable.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            total = event.data.contentLength || 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (total > 0) {
              setProgress(Math.round((downloaded / total) * 100));
            }
            break;
          case 'Finished':
            setProgress(100);
            break;
        }
      });

      // 升级替换完成后重新拉起应用
      await relaunch();
    } catch (err: any) {
      console.error('Download update error:', err);
      setErrorMsg(err.message || '下载或升级替换失败');
      setDownloading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="update-modal max-w-lg"
      title={
        <div className="flex items-center gap-2">
          <RefreshCw className={checking ? 'animate-spin' : ''} size={18} color="#2c4f9e" />
          软件在线更新
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="outline" size="sm" onClick={onClose} disabled={downloading}>
            关闭
          </Button>

          {!checking && !updateAvailable && (
            <Button variant="default" size="sm" onClick={performCheck}>
              重新检查
            </Button>
          )}

          {!checking && updateAvailable && (
            <Button variant="default" size="sm" onClick={handleStartUpdate} disabled={downloading}>
              <Download size={14} />
              {downloading ? '升级中...' : '立即下载并重启更新'}
            </Button>
          )}
        </div>
      }
    >
      <div className="py-2">
        {checking && (
          <div className="update-state-box text-center py-6">
            <RefreshCw className="animate-spin mx-auto mb-3" size={32} color="#2c4f9e" />
            <p className="update-state-tip text-sm text-[var(--text-muted)]">正在检查远程服务器最新版本...</p>
          </div>
        )}

        {!checking && upToDate && (
          <div className="update-state-box text-center py-6">
            <CheckCircle className="mx-auto mb-3" size={44} color="#3b7a4b" />
            <h4 className="update-state-title text-base font-semibold">当前已是最新版本</h4>
            <p className="update-state-sub text-xs text-[var(--text-muted)] mt-1">DocMind v{pkg.version} 已处于最佳运行状态</p>
          </div>
        )}

        {!checking && errorMsg && (
          <div className="update-error-box p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">
            <div className="update-error-title font-semibold flex items-center gap-2 mb-1">
              <AlertTriangle size={16} />
              检查更新提示
            </div>
            <div className="update-error-msg">{errorMsg}</div>
          </div>
        )}

        {!checking && updateAvailable && (
          <div className="update-available-section space-y-3">
            <div className="update-banner p-3 rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] flex justify-between items-center">
              <div className="update-version font-bold text-base">
                发现新版本 v{updateAvailable.version}
              </div>
              <div className="update-date text-xs text-[var(--text-muted)]">
                发布时间: {updateAvailable.date || '最新'}
              </div>
            </div>

            {updateAvailable.body && (
              <div className="update-notes-container p-3 rounded border border-[var(--border-default)]">
                <div className="update-notes-label font-semibold text-xs mb-1">更新说明：</div>
                <div className="update-notes-content text-xs whitespace-pre-wrap">
                  {updateAvailable.body}
                </div>
              </div>
            )}

            {downloading && (
              <div className="update-progress-container space-y-1">
                <div className="update-progress-info flex justify-between text-xs">
                  <span>正在下载安装包并自动替换更新...</span>
                  <span>{progress}%</span>
                </div>
                <div className="update-progress-track w-full h-2 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                  <div className="update-progress-bar h-full bg-[var(--primary-500)] transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
