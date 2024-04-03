const { FreeSwitchClient, once } = require('esl');

const hangup_all_calls = async () => {
  const client = new FreeSwitchClient({
    host: 'freeswitch',
    port: 8021,
  });

  const fs_command = async (cmd) => {
    const p = once(client, 'connect');
    await client.connect();
    const [call] = await p;
    const res = await call.api(cmd);
    // res.body.should.match(/\+OK/);
    await call.exit();
    await client.end();
  };

  await fs_command("hupall");
}

module.exports = {
  hangup_all_calls,
}
