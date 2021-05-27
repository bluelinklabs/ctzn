import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import * as session from '../lib/session.js'

const METRIC_GRAPH_COLORS = {
  'signed-up': 'rgba(255, 99, 132, 1)',
  'logged-in': 'rgba(54, 162, 235, 1)',
  'post-created': 'rgba(75, 192, 192, 1)',
  'comment-created': 'rgba(153, 102, 255, 1)'
}

class Dashboard extends LitElement {
  static get properties () {
    return {
      metrics: {type: Object},
      httpHits: {type: Object}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.metrics = {}
    this.httpHits = []
  }


  connectedCallback () {
    super.connectedCallback()
    this.load()
  }

  async load () {
    await session.setup()
    const [users] = await Promise.all([
      session.api.get('admin/users-count')
    ])
    this.metrics = {
      fixed: {users: users.count},
      day: {},
      week: {},
      month: {},
      overtime: {}
    }
    this.requestUpdate()
    this.metrics.day = (await session.api.get('admin/multiple-metrics-events-counts', {
      timespan: 'day',
      events: 'signed-up,logged-in,post-created,comment-created',
      uniqueBys: 'logged-in:user'
    })).count
    this.requestUpdate()
    this.metrics.week = (await session.api.get('admin/multiple-metrics-events-counts', {
      timespan: 'week',
      events: 'signed-up,logged-in,post-created,comment-created',
      uniqueBys: 'logged-in:user'
    })).count
    this.requestUpdate()
    this.metrics.month = (await session.api.get('admin/multiple-metrics-events-counts', {
      timespan: 'month',
      events: 'signed-up,logged-in,post-created,comment-created',
      uniqueBys: 'logged-in:user'
    })).count
    this.requestUpdate()
    this.httpHits = Object.entries((await session.api.get('admin/aggregate-http-hits', {timespan: 'day'})).hits)
    this.httpHits.sort((a, b) => b[1] - a[1])
    this.requestUpdate()
    this.metrics.overtime = (await session.api.get('admin/multiple-metrics-events-counts-over-time', {
      timespan: 'month',
      window: 'day',
      events: 'signed-up,logged-in,post-created,comment-created',
      uniqueBys: 'logged-in:user'
    })).counts
    this.updateOvertimeGraphs(this.metrics.overtime)
    console.log(this.metrics)
  }

  updateOvertimeGraphs (overtime) {
    const labels = Object.keys(overtime).map(ts => (new Date(+ts)).toLocaleDateString())
    const datasets = []
    for (let evt of ['signed-up', 'logged-in', 'post-created', 'comment-created']) {
      datasets.push({
        label: evt,
        data: Object.values(overtime).map(({counts}) => counts[evt] || 0),
        borderColor: METRIC_GRAPH_COLORS[evt],
        fill: false
      })
    }
    const ctx = this.querySelector(`#metrics-graph`).getContext('2d')
    var myChart = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets,
      }
    })
  }

  render () {
    const m = v => typeof v === 'undefined' ? '-' : v
    const renderTimespanMetrics = metrics => html`
      <div class="flex items-center bg-gray-100 rounded-xl pr-4 pl-6 pt-2 pb-3">
        <div class="flex-1">
          <div class="text-2xl font-semibold">${m(metrics?.['logged-in'])}</div>
          <div class="text-gray-600">Logins</div>
        </div>
        <div class="flex-1">
          <div class="text-2xl font-semibold">${m(metrics?.['signed-up'])}</div>
          <div class="text-gray-600">Signups</div>
        </div>
        <div class="flex-1">
          <div class="text-2xl font-semibold">${m(metrics?.['post-created'])}</div>
          <div class="text-gray-600">Posts</div>
        </div>
        <div class="flex-1">
          <div class="text-2xl font-semibold">${m(metrics?.['comment-created'])}</div>
          <div class="text-gray-600">Comments</div>
        </div>
      </div>
    `
    return html`
      <div class="px-3 pt-5 pb-6">
        <h4 class="font-semibold text-3xl border-b-2 border-pink-600 pb-6 mb-8">
          Admin Dashboard
        </h4>
        <div class="flex items-center px-4">
          <div class="flex-1">
            <div class="text-4xl font-semibold">${m(this.metrics?.fixed?.users)}</div>
            <div>Registered Users</div>
          </div>
          <div class="flex-1"></div>
        </div>
      </div>
      <div class="px-3 pt-2 pb-2">
        <h4 class="font-semibold text-lg">Today</h4>
        ${renderTimespanMetrics(this.metrics?.day)}
      </div>
      <div class="px-3 pt-2 pb-2">
        <h4 class="font-semibold text-lg">This Week</h4>
        ${renderTimespanMetrics(this.metrics?.week)}
      </div>
      <div class="px-3 pt-2 pb-2">
        <h4 class="font-semibold text-lg">This Month</h4>
        ${renderTimespanMetrics(this.metrics?.month)}
      </div>
      <div class="px-3 pt-2 pb-2">
        <h4 class="font-semibold text-lg">HTTP Requests <span class="text-sm font-normal text-gray-600">Past 24 hours</span></h4>
        <div class="overflow-y-auto font-mono text-sm text-gray-800 border border-gray-200 rounded px-1 py-2" style="max-height: 400px">
          ${repeat(this.httpHits, ([path]) => path, ([path, count]) => html`
            <div class="flex zebra-row px-1 py-0.5">
              <div class="flex-1 truncate">${path}</div>
              <div style="flex: 0 0 100px">${count}</div>
            </div>
          `)}
        </div>
      </div>
      <div class="px-3 pt-8 pb-6">
        <h4 class="font-semibold text-lg">Metrics <span class="text-sm font-normal text-gray-600">Past month</span></h4>
        <canvas id="metrics-graph"></canvas>
      </div>
    `
  }

  // events
  // =

}
customElements.define('app-dashboard', Dashboard)