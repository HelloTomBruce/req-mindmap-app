import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function runTest() {
  console.log('--- 开始使用官方 @modelcontextprotocol/sdk 测试 SSE 连接 ---');
  
  const transport = new SSEClientTransport(
    new URL('http://127.0.0.1:6001/sse')
  );

  const client = new Client(
    {
      name: 'test-client',
      version: '1.0.0'
    },
    {
      capabilities: {}
    }
  );

  try {
    console.log('正在尝试连接 http://127.0.0.1:6001/sse ...');
    await client.connect(transport);
    console.log('✅ SSE 客户端连接成功！已完成握手！');

    const tools = await client.listTools();
    console.log('✅ 成功调取 tools/list 列表:', JSON.stringify(tools, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('❌ MCP 客户端连接失败:', err);
    process.exit(1);
  }
}

runTest();
