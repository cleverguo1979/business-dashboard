/**
 * 应用主布局 - 侧边栏 + 内容区
 */
import React, { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  UploadOutlined,
  DatabaseOutlined,
  BarChartOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';

const { Sider, Content, Header } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '当月看板' },
  { key: '/overview', icon: <LineChartOutlined />, label: '总分析' },
  { key: '/import', icon: <UploadOutlined />, label: '导入数据' },
  { key: '/data', icon: <DatabaseOutlined />, label: '数据管理' },
];

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{ background: token.colorBgContainer }}
        theme="light"
      >
        <div style={{
          height: 48,
          margin: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: collapsed ? 14 : 18,
          color: token.colorPrimary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          cursor: 'pointer',
        }} onClick={() => navigate('/')}>
          <BarChartOutlined style={{ marginRight: collapsed ? 0 : 8 }} />
          {!collapsed && '标准化业务看板'}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: token.colorBgContainer,
          padding: '0 24px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          alignItems: 'center',
          fontSize: 16,
          fontWeight: 500,
        }}>
          {menuItems.find(item => item.key === location.pathname)?.label || '标准化业务看板'}
        </Header>
        <Content style={{ margin: 16, overflow: 'auto' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};
