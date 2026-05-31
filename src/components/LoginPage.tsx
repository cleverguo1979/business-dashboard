/**
 * 登录页面 - 邀请词验证
 */
import React, { useState } from 'react';
import { Input, Button, message } from 'antd';
import { LockOutlined, RocketOutlined } from '@ant-design/icons';

interface Props {
  onSuccess: () => void;
}

export const LoginPage: React.FC<Props> = ({ onSuccess }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    // 模拟验证延迟
    setTimeout(() => {
      if (code === '远海通') {
        message.success('欢迎使用标准化业务看板');
        onSuccess();
      } else {
        message.error('邀请词不正确');
      }
      setLoading(false);
    }, 600);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e8f4f8 0%, #d4e8f0 30%, #c9e4f0 60%, #e0f0f8 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(20px)',
        borderRadius: 16,
        padding: '48px 40px',
        width: 380,
        boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'linear-gradient(135deg, #1677ff, #52c41a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <RocketOutlined style={{ fontSize: 28, color: '#fff' }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
            标准化业务看板
          </h1>
          <p style={{ color: '#999', fontSize: 13, marginTop: 8 }}>
            请输入邀请词进入系统
          </p>
        </div>

        {/* 输入框 */}
        <Input
          size="large"
          prefix={<LockOutlined style={{ color: '#bbb' }} />}
          placeholder="请输入邀请词"
          value={code}
          onChange={e => setCode(e.target.value)}
          onPressEnter={handleLogin}
          style={{
            borderRadius: 10,
            height: 48,
            fontSize: 15,
            border: '1px solid #e8e8e8',
          }}
        />

        {/* 按钮 */}
        <Button
          type="primary"
          size="large"
          block
          loading={loading}
          onClick={handleLogin}
          style={{
            marginTop: 20,
            height: 48,
            borderRadius: 10,
            fontSize: 16,
            fontWeight: 600,
            background: 'linear-gradient(135deg, #1677ff, #4096ff)',
            border: 'none',
          }}
        >
          进入看板
        </Button>

        <div style={{ marginTop: 32, color: '#ccc', fontSize: 11 }}>
          标准化业务报关单数据分析系统
        </div>
      </div>
    </div>
  );
};
