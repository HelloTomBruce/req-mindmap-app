import React, { useState, useEffect } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { RefreshCw, Download, CheckCircle, AlertTriangle, X } from 'lucide-react';

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

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content update-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <RefreshCw className={checking ? 'spin' : ''} size={18} color="#2563eb" />
            软件在线更新
          </div>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {checking && (
            <div className="update-state-box">
              <RefreshCw className="spin" size={32} color="#2563eb" />
              <p className="update-state-tip">正在检查远程服务器最新版本...</p>
            </div>
          )}

          {!checking && upToDate && (
            <div className="update-state-box">
              <CheckCircle size={44} color="#10b981" />
              <h4 className="update-state-title">当前已是最新版本</h4>
              <p className="update-state-sub">DocMind v{pkg.version} 已处于最佳运行状态</p>
            </div>
          )}

          {!checking && errorMsg && (
            <div className="update-error-box">
              <div className="update-error-title">
                <AlertTriangle size={18} />
                检查更新提示
              </div>
              <div className="update-error-msg">{errorMsg}</div>
            </div>
          )}

          {!checking && updateAvailable && (
            <div className="update-available-section">
              <div className="update-banner">
                <div className="update-version">
                  发现新版本 v{updateAvailable.version}
                </div>
                <div className="update-date">
                  发布时间: {updateAvailable.date || '最新'}
                </div>
              </div>

              {updateAvailable.body && (
                <div className="update-notes-container">
                  <div className="update-notes-label">更新说明：</div>
                  <div className="update-notes-content">
                    {updateAvailable.body}
                  </div>
                </div>
              )}

              {downloading && (
                <div className="update-progress-container">
                  <div className="update-progress-info">
                    <span>正在下载安装包并自动替换更新...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="update-progress-track">
                    <div className="update-progress-bar" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn outline" onClick={onClose} disabled={downloading}>
            关闭
          </button>

          {!checking && !updateAvailable && (
            <button className="btn primary" onClick={performCheck}>
              重新检查
            </button>
          )}

          {!checking && updateAvailable && (
            <button className="btn primary" onClick={handleStartUpdate} disabled={downloading}>
              <Download size={14} />
              {downloading ? '升级中...' : '立即下载并重启更新'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
