import * as core from '@actions/core'
import { App, BlockAction, LogLevel } from '@slack/bolt'
import { WebClient } from '@slack/web-api'

const token = process.env.SLACK_BOT_TOKEN || ""
const signingSecret =  process.env.SLACK_SIGNING_SECRET || ""
const slackAppToken = process.env.SLACK_APP_TOKEN || ""
const channel_id    = process.env.SLACK_CHANNEL_ID || ""
const plan    = process.env.PLAN || ""
const layer   = process.env.LAYER || ""
const action  = process.env.ACTION || ""
const workspace  = process.env.WORKSPACE || ""

const app = new App({
  token: token,
  signingSecret: signingSecret,
  appToken: slackAppToken,
  socketMode: true,
  port: 3000,
  logLevel: LogLevel.DEBUG,
});

async function run(): Promise<void> {
  try {
    const web = new WebClient(token);

    const github_server_url = process.env.GITHUB_SERVER_URL || "";
    const github_repos = process.env.GITHUB_REPOSITORY || "";
    const run_id = process.env.GITHUB_RUN_ID || "";
    const actionsUrl = `${github_server_url}/${github_repos}/actions/runs/${run_id}`;
    const workflow   = process.env.GITHUB_WORKFLOW || "";
    const runnerOS   = process.env.RUNNER_OS || "";
    const actor      = process.env.GITHUB_ACTOR || "";
    const service_name = process.env.SERVICE_NAME || "";
    const environment = process.env.ENVIRONMENT || "";
    const project_id = process.env.PROJECT_ID || "";
    const github_branch = process.env.GITHUB_REF_NAME || "";
    const block_template:any = [
      {
      "type": "section",
      "text": {
          "type": "mrkdwn",
          "text": `*GitHub Actions Approval Request*`,
        }
      }
    ];
    var regex = /[^\r\n]+/g;
    var plan_array_filter = plan.match(regex);
    if (plan_array_filter != null) {
      block_template.push({
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*Plan:*`,
        }
      })
      if(plan.length > 39000) {
        block_template.push(
          {
            "type": "rich_text",
            "elements": [
              {
                "type": "rich_text_preformatted",
                "elements": [
                  {
                    "type": "text",
                    "text": `Plan is too big. Look at the plan on the build job`
                  }
                ]
              }
            ]
          });
      }
      else {
        var plan_array;
        plan_array = [];
        var temp = "";
        var item = "";
        while (plan_array_filter.length != 0) {
          var shift = plan_array_filter.shift();
          if (shift !== undefined) {
            item = shift;
            item = item.concat(`\n`);
          }
          if ((temp.length + item.length) > 2990) {
            if (temp.length > 0) {
              plan_array.push(temp);
            }
            temp = item;
            console.log(plan_array);
          }
          else {
            temp = temp.concat(item);
          }
          if (plan_array_filter.length == 0) {
            plan_array.push(temp);
          }
        }
        plan_array.forEach((element) => {
          block_template.push(
            {
              "type": "section",
              "text": {
                "type": "mrkdwn",
                "text": `\`\`\`${element}\`\`\``,
              }
            })
          });
      }
    }
    block_template.push(
      {
        "type": "section",
        "fields": [
          {
            "type": "mrkdwn",
            "text": `*Worflow:*\n${workflow}`
          },
          {
            "type": "mrkdwn",
            "text": `*GitHub Actor:*\n${actor}`
          },
          {
            "type": "mrkdwn",
            "text": `*Repos:*\n${github_server_url}/${github_repos}`
          },
          {
            "type": "mrkdwn",
            "text": `*Actions URL:*\n${actionsUrl}`
          }
        ]
      },
      {
        "type": "section",
        "text":
          {
            "type": "mrkdwn",
            "text": `*Branch:*\n${github_branch}`
          }
      },
      {
        "type": "section",
        "text":
          {
            "type": "mrkdwn",
            "text": `:exclamation: *Trigger '${action}' on '${layer}' layer in '${workspace}'* :exclamation:`
          }
      },
      {
          "type": "actions",
          "elements": [
              {
                  "type": "button",
                  "text": {
                      "type": "plain_text",
                      "emoji": true,
                      "text": "Approve"
                  },
                  "style": "primary",
                  "value": "approve",
                  "action_id": `slack-approval-approve-${run_id}`
              },
              {
                  "type": "button",
                  "text": {
                          "type": "plain_text",
                          "emoji": true,
                          "text": "Reject"
                  },
                  "style": "danger",
                  "value": "reject",
                  "action_id": `slack-approval-reject-${run_id}`
              }
          ]
      }
      );
    (async () => {
      await web.chat.postMessage({ 
        channel: channel_id, 
        text: "GitHub Actions Approval request",
        blocks: block_template
      });
    })();

    app.action(`slack-approval-approve-${run_id}`, async ({ack, client, body, logger}) => {
      await ack();
      try {
        const response_blocks = (<BlockAction>body).message?.blocks
        block_template.pop()
        block_template.push({
          'type': 'section',
          'text': {
            'type': 'mrkdwn',
            'text': `Approved by <@${body.user.id}>\n`,
          },
        })

        await client.chat.update({
          channel: body.channel?.id || "",
          ts: (<BlockAction>body).message?.ts || "",
          blocks: block_template
        })
      } catch (error) {
        logger.error(error)
      }

      process.exit(0)
    });

    app.action(`slack-approval-reject-${run_id}`, async ({ack, client, body, logger}) => {
      await ack();
      try {
        const response_blocks = (<BlockAction>body).message?.blocks
        block_template.pop()
        block_template.push({
          'type': 'section',
          'text': {
            'type': 'mrkdwn',
            'text': `Rejected by <@${body.user.id}>\n`,
          },
        })

        await client.chat.update({
          channel: body.channel?.id || "",
          ts: (<BlockAction>body).message?.ts || "",
          blocks: block_template
        })
      } catch (error) {
        logger.error(error)
      }

      process.exit(1)
    });

    (async () => {
      await app.start(3000);
      console.log('Waiting Approval reaction.....');
    })();
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
