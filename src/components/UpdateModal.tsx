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
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: '520px', maxWidth: '90vw', padding: '24px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px' }}>
            <RefreshCw className={checking ? 'spin' : ''} size={20} color="#007acc" />
            软件远程自动更新
          </h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {checking && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <RefreshCw className="spin" size={32} color="#007acc" style={{ marginBottom: '12px' }} />
            <p style={{ color: '#666', margin: 0 }}>正在检查远程服务器最新版本...</p>
          </div>
        )}

        {!checking && upToDate && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <CheckCircle size={44} color="#52c41a" style={{ marginBottom: '12px' }} />
            <h4 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>当前已是最新版本</h4>
            <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>ReqMindmark v{pkg.version} 已处于最佳运行状态</p>
          </div>
        )}

        {!checking && errorMsg && (
          <div style={{ backgroundColor: '#fff2f0', border: '1px solid #ffccc7', borderRadius: '6px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ff4d4f', fontWeight: 600, marginBottom: '6px' }}>
              <AlertTriangle size={18} />
              检查更新提示
            </div>
            <div style={{ color: '#666', fontSize: '13px', wordBreak: 'break-all' }}>{errorMsg}</div>
          </div>
        )}

        {!checking && updateAvailable && (
          <div>
            <div style={{ backgroundColor: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: '6px', padding: '12px 16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#0050b3' }}>
                发现新版本 v{updateAvailable.version}
              </div>
              <div style={{ fontSize: '12px', color: '#595959', marginTop: '4px' }}>
                发布时间: {updateAvailable.date || '最新'}
              </div>
            </div>

            {updateAvailable.body && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#444' }}>更新说明：</div>
                <div style={{
                  maxHeight: '140px',
                  overflowY: 'auto',
                  backgroundColor: '#f5f5f5',
                  padding: '10px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#333',
                  whiteSpace: 'pre-wrap'
                }}>
                  {updateAvailable.body}
                </div>
              </div>
            )}

            {downloading && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>正在下载包文件并自动替换更新...</span>
                  <span>{progress}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: '#e8e8e8', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', backgroundColor: '#1890ff', transition: 'width 0.3s ease' }} />
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
          <button className="btn secondary" onClick={onClose} disabled={downloading}>
            关闭
          </button>

          {!checking && !updateAvailable && (
            <button className="btn primary" onClick={performCheck}>
              重新检查
            </button>
          )}

          {!checking && updateAvailable && (
            <button className="btn primary" onClick={handleStartUpdate} disabled={downloading}>
              <Download size={16} style={{ marginRight: '6px' }} />
              {downloading ? '升级中...' : '立即下载并重启更新'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
