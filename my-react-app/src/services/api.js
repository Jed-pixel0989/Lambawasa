// Frontend data service for Supabase auth/state and the legacy PHP API.

import { isSupabaseConfigured, supabase } from './supabase'

const getApiUrl = (endpoint) => {
  const vitePort = Number(window.location.port)
  const isViteServer = vitePort === 4173 || (vitePort >= 5173 && vitePort <= 5199)
  const isLegacySiaInstall = window.location.pathname.startsWith('/SIA/')
  const apiPath = isViteServer || isLegacySiaInstall ? '/SIA/api' : '/api'
  const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '')
  const base = configuredBase || `${window.location.origin}${apiPath}`
  return `${base}/${endpoint}`
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL and a matching publishable key in Vercel.')
  }
  return supabase
}

const sharedStateResult = (data) => ({
  success: true,
  mode: 'shared_state',
  ...(data !== undefined ? { data } : {}),
})

async function stageSharedStateChange(data) {
  const client = requireSupabase()
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Sign in with an active staff account before changing shared records.')
  const { data: staffProfile, error: profileError } = await client
    .from('users')
    .select('status')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (profileError) throw profileError
  if (staffProfile?.status !== 'Active') {
    throw new Error('Only active staff accounts can change shared operational records.')
  }
  return sharedStateResult(data)
}

async function getAuthenticatedProfile(client, authUser) {
  const { data: staffProfile, error: staffError } = await client
    .from('users')
    .select('id, auth_user_id, username, full_name, email, contact_no, zone, role, status')
    .eq('auth_user_id', authUser.id)
    .maybeSingle()
  if (staffError) throw staffError

  if (staffProfile) {
    if (staffProfile.status !== 'Active') {
      throw new Error('This staff account is inactive. Contact the system administrator.')
    }
    return {
      id: staffProfile.id,
      authUserId: authUser.id,
      username: staffProfile.username,
      fullName: staffProfile.full_name,
      email: staffProfile.email,
      contact: staffProfile.contact_no,
      zone: staffProfile.zone,
      role: staffProfile.role,
    }
  }

  const { data: consumer, error: consumerError } = await client
    .from('consumers')
    .select('id, consumer_code, account_no, username, email, full_name, contact_no, service_address, zone, meter_serial, status, approval_status, classification')
    .eq('auth_user_id', authUser.id)
    .maybeSingle()
  if (consumerError) throw consumerError
  if (!consumer) throw new Error('No Lambawasa profile is linked to this sign-in. Contact the system administrator.')
  if (consumer.approval_status === 'Pending') {
    throw new Error('Your household account is awaiting President approval.')
  }
  if (consumer.approval_status !== 'Approved') {
    throw new Error('This household account is not approved. Contact the utility office.')
  }

  return {
    id: consumer.consumer_code,
    authUserId: authUser.id,
    username: consumer.username,
    fullName: consumer.full_name,
    email: consumer.email,
    contact: consumer.contact_no,
    role: 'House Hold',
    consumerId: consumer.consumer_code,
    accountNo: consumer.account_no,
    meterNo: consumer.meter_serial,
    zone: consumer.zone,
    address: consumer.service_address,
    classification: consumer.classification,
    isNewAccount: false,
  }
}

const parseApiResponse = async (response) => {
  const body = await response.text()
  if (!body.trim()) {
    throw new Error(`API returned an empty response (HTTP ${response.status}). Check VITE_API_BASE_URL and the PHP API deployment.`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`API returned ${contentType || 'no content type'} instead of JSON (HTTP ${response.status}). Check VITE_API_BASE_URL.`)
  }

  try {
    return JSON.parse(body)
  } catch {
    throw new Error(`API returned invalid JSON (HTTP ${response.status}). Check the PHP API logs.`)
  }
}

export const api = {
  async getCurrentUser() {
    const client = requireSupabase()
    const { data: { session }, error } = await client.auth.getSession()
    if (error) throw error
    if (!session?.user) return null
    return getAuthenticatedProfile(client, session.user)
  },

  async signOut() {
    const client = requireSupabase()
    const { error } = await client.auth.signOut()
    if (error) throw error
  },

  async registerConsumer(consumerData) {
    const client = requireSupabase()
    const { data, error } = await client.auth.signUp({
      email: consumerData.email,
      password: consumerData.password,
      options: {
        data: {
          app_role: 'House Hold',
          full_name: consumerData.fullName,
          contact_no: consumerData.mobile,
          username: consumerData.username,
          service_address: consumerData.address,
          zone: consumerData.zone,
          classification: consumerData.classification,
          latitude: String(consumerData.serviceCoordinates.lat),
          longitude: String(consumerData.serviceCoordinates.lng),
        },
      },
    })
    if (error) throw error
    const confirmationRequired = !data.session
    if (data.session) {
      const { error: signOutError } = await client.auth.signOut()
      if (signOutError) throw signOutError
    }
    return {
      success: true,
      confirmationRequired,
      user: data.user,
    }
  },

  async fetchSharedState() {
    const client = requireSupabase()
    const { data, error } = await client
      .from('app_state')
      .select('payload, updated_at, revision')
      .eq('state_key', 'lambawasa')
      .maybeSingle()
    if (error) throw error
    return data
  },

  async fetchStaffBootstrapData() {
    const client = requireSupabase()
    const [consumerResult, meterResult, geoResult] = await Promise.all([
      client.from('consumers').select(
        'id, consumer_code, account_no, username, email, full_name, contact_no, service_address, zone, classification, meter_serial, status, approval_status, location_approval_status, requested_latitude, requested_longitude, connection_date, last_reading'
      ),
      client.from('meter_assets').select(
        'id, serial_no, brand, model, pipe_size, install_date, consumer_id, zone, last_calibration, next_calibration, status'
      ),
      client.from('geo_connections').select(
        'id, consumer_id, zone, latitude, longitude, status'
      ),
    ])
    if (consumerResult.error) throw consumerResult.error
    if (meterResult.error) throw meterResult.error
    if (geoResult.error) throw geoResult.error

    const consumers = consumerResult.data.map((consumer) => ({
      id: consumer.consumer_code,
      consumerCode: consumer.consumer_code,
      accountNo: consumer.account_no,
      username: consumer.username,
      name: consumer.full_name,
      email: consumer.email,
      contact: consumer.contact_no,
      zone: consumer.zone,
      cluster: consumer.zone,
      address: consumer.service_address,
      classification: consumer.classification,
      meterNo: consumer.meter_serial,
      status: consumer.approval_status === 'Pending'
        ? 'Pending Approval'
        : consumer.approval_status === 'Rejected'
          ? 'Rejected'
          : consumer.status,
      approvalStatus: consumer.approval_status,
      locationApprovalStatus: consumer.location_approval_status,
      latitude: consumer.requested_latitude,
      longitude: consumer.requested_longitude,
      requestedLatitude: consumer.requested_latitude,
      requestedLongitude: consumer.requested_longitude,
      connectionDate: consumer.connection_date,
      lastReading: Number(consumer.last_reading),
      avatar: consumer.full_name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase(),
      isNewAccount: consumer.approval_status === 'Pending',
      databaseId: consumer.id,
    }))
    const consumerByDatabaseId = new Map(consumerResult.data.map((consumer) => [consumer.id, consumer]))

    return {
      consumers,
      meters: meterResult.data.map((meter) => {
        const consumer = consumerByDatabaseId.get(meter.consumer_id)
        return {
          serialNo: meter.serial_no,
          brand: meter.brand,
          model: meter.model,
          size: meter.pipe_size,
          installDate: meter.install_date,
          consumerId: consumer?.consumer_code,
          consumerName: consumer?.full_name,
          zone: meter.zone,
          lastCalibration: meter.last_calibration,
          nextCalibration: meter.next_calibration,
          status: meter.status,
          databaseId: meter.id,
        }
      }),
      geoPins: geoResult.data.map((pin) => {
        const consumer = consumerByDatabaseId.get(pin.consumer_id)
        return {
          id: `GP-${pin.id}`,
          consumerId: consumer?.consumer_code,
          name: consumer?.full_name,
          zone: pin.zone,
          lat: Number(pin.latitude),
          lng: Number(pin.longitude),
          status: pin.status,
          meterNo: consumer?.meter_serial,
          reading: Number(consumer?.last_reading || 0),
        }
      }),
    }
  },

  async saveSharedState(payload, expectedUpdatedAt = null, expectedRevision = 0) {
    const client = requireSupabase()
    const { data: { user }, error: userError } = await client.auth.getUser()
    if (userError) throw userError
    if (!user) throw new Error('Your session expired. Sign in again to sync changes.')

    if (!expectedUpdatedAt) {
      const { data, error } = await client
        .from('app_state')
        .insert({ state_key: 'lambawasa', payload, updated_by: user.id })
        .select('payload, updated_at, revision')
        .maybeSingle()
      if (error) throw error
      return data
    }

    const { data, error } = await client
      .from('app_state')
      .update({
        payload,
        updated_by: user.id,
        revision: expectedRevision + 1,
      })
      .eq('state_key', 'lambawasa')
      .eq('updated_at', expectedUpdatedAt)
      .select('payload, updated_at, revision')
      .maybeSingle()
    if (error) throw error
    if (!data) {
      const conflict = new Error('Another device saved changes first. The latest shared data is being loaded.')
      conflict.code = 'SYNC_CONFLICT'
      throw conflict
    }
    return data
  },

  subscribeSharedState(onChange) {
    const client = requireSupabase()
    const channel = client
      .channel('lambawasa-app-state')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'app_state',
        filter: 'state_key=eq.lambawasa',
      }, onChange)
      .subscribe()
    return () => client.removeChannel(channel)
  },

  // Check Supabase configuration and authenticated state.
  async checkDbStatus() {
    try {
      if (isSupabaseConfigured) {
        const client = requireSupabase()
        const { data: { session }, error } = await client.auth.getSession()
        if (error) throw error
        return { success: true, connected: true, mode: 'supabase', authenticated: Boolean(session) }
      }
      const res = await fetch(getApiUrl('status.php'), { method: 'GET' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await parseApiResponse(res)
    } catch (err) {
      console.warn('DB Status Check Error:', err)
      return { success: true, connected: false, mode: 'local', error: err.message }
    }
  },

  // Fetch all initial data from MySQL waterline_db
  async fetchSystemData() {
    try {
      if (isSupabaseConfigured) {
        const data = await this.fetchSharedState()
        return data?.payload || null
      }
      const res = await fetch(getApiUrl('data.php'), { method: 'GET' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await parseApiResponse(res)
      if (json.success && json.data) {
        return json.data
      }
      throw new Error(json.error || 'Failed to parse database data')
    } catch (err) {
      console.error('Failed to fetch system data from database:', err)
      return null
    }
  },

  async saveBoundaries(serviceBoundary, clusterBoundaries) {
    if (isSupabaseConfigured) return stageSharedStateChange({ serviceBoundary, clusterBoundaries })
    try {
      const res = await fetch(getApiUrl('boundaries.php'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceBoundary, clusterBoundaries }),
      })
      return await parseApiResponse(res)
    } catch {
      localStorage.setItem('lambawasa_serviceBoundary', JSON.stringify(serviceBoundary))
      localStorage.setItem('lambawasa_clusterBoundaries', JSON.stringify(clusterBoundaries))
      return { success: true, mode: 'local' }
    }
  },

  // Create Consumer
  async addConsumer(consumerData) {
    if (isSupabaseConfigured) return stageSharedStateChange(consumerData)
    try {
      const res = await fetch(getApiUrl('consumers.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(consumerData),
      })
      return await parseApiResponse(res)
    } catch (err) {
      console.error('API addConsumer error:', err)
      return { success: false, error: err.message }
    }
  },

  async updateConsumerApproval(consumerId, approvalStatus) {
    if (isSupabaseConfigured) {
      await stageSharedStateChange({ consumerId, approvalStatus })
      const client = requireSupabase()
      const { data: consumer, error } = await client
        .from('consumers')
        .update({
          approval_status: approvalStatus,
          status: approvalStatus === 'Approved' ? 'Active' : 'Pending',
        })
        .eq('consumer_code', consumerId)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!consumer) throw new Error('The household registration was not found in Supabase.')

      const { error: meterError } = await client
        .from('meter_assets')
        .update({ status: approvalStatus === 'Approved' ? 'Active' : 'Decommissioned' })
        .eq('consumer_id', consumer.id)
      if (meterError) throw meterError
      return sharedStateResult({ consumerId, approvalStatus })
    }
    try {
      const res = await fetch(getApiUrl('consumers.php'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumerId, approvalStatus }),
      })
      return await parseApiResponse(res)
    } catch (err) {
      console.error('API updateConsumerApproval error:', err)
      return { success: false, error: err.message }
    }
  },

  async deleteConsumer(consumerId, actorRole) {
    if (isSupabaseConfigured) return stageSharedStateChange({ consumerId, actorRole, deletedPayments: 0 })
    try {
      const res = await fetch(getApiUrl('consumers.php'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumerId, actorRole }),
      })
      return await parseApiResponse(res)
    } catch (err) {
      console.error('API deleteConsumer error:', err)
      return { success: false, error: err.message }
    }
  },

  async updateConsumerProfile(profileData) {
    try {
      if (isSupabaseConfigured) {
        const client = requireSupabase()
        const updates = {}
        if (profileData.email) updates.email = profileData.email.trim().toLowerCase()
        if (profileData.password) updates.password = profileData.password
        let emailConfirmationRequired = false
        if (Object.keys(updates).length) {
          const { data: { user }, error: authError } = await client.auth.updateUser(updates)
          if (authError) throw authError
          emailConfirmationRequired = Boolean(
            profileData.email && user?.email !== profileData.email.trim().toLowerCase()
          )
        }

        const consumerUpdates = {}
        if (profileData.email && !emailConfirmationRequired) {
          consumerUpdates.email = profileData.email.trim().toLowerCase()
        }
        if (profileData.contact) consumerUpdates.contact_no = profileData.contact
        if (Object.keys(consumerUpdates).length) {
          const { data: { user }, error: userError } = await client.auth.getUser()
          if (userError) throw userError
          if (!user) throw new Error('Your session expired. Sign in again to update your profile.')
          const { error: profileError } = await client
            .from('consumers')
            .update(consumerUpdates)
            .eq('auth_user_id', user.id)
          if (profileError) throw profileError
        }
        return { success: true, emailConfirmationRequired }
      }

      const res = await fetch(getApiUrl('consumers.php'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'profile-update', ...profileData }),
      })
      return await parseApiResponse(res)
    } catch (err) {
      console.error('API updateConsumerProfile error:', err)
      return { success: false, error: err.message }
    }
  },

  async requestConsumerLocationChange(consumerId, latitude, longitude) {
    if (isSupabaseConfigured) return stageSharedStateChange({ consumerId, latitude, longitude })
    try {
      const res = await fetch(getApiUrl('consumers.php'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'location-request', consumerId, latitude, longitude }),
      })
      return await parseApiResponse(res)
    } catch (err) {
      console.error('API requestConsumerLocationChange error:', err)
      return { success: false, error: err.message }
    }
  },

  async decideConsumerLocationChange(consumerId, locationApprovalStatus) {
    if (isSupabaseConfigured) return stageSharedStateChange({ consumerId, locationApprovalStatus })
    try {
      const res = await fetch(getApiUrl('consumers.php'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'location-decision', consumerId, locationApprovalStatus }),
      })
      return await parseApiResponse(res)
    } catch (err) {
      console.error('API decideConsumerLocationChange error:', err)
      return { success: false, error: err.message }
    }
  },

  // Process POS Payment
  async processPayment(paymentData) {
    if (isSupabaseConfigured) return stageSharedStateChange({})
    try {
      const res = await fetch(getApiUrl('payments.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData),
      })
      return await parseApiResponse(res)
    } catch (err) {
      console.error('API processPayment error:', err)
      return { success: false, error: err.message }
    }
  },

  // Create PayMongo Checkout Session
  async getPaymongoConfig() {
    if (isSupabaseConfigured) {
      return {
        success: true,
        configured: false,
        error: 'PayMongo is not connected to the Supabase deployment.',
      }
    }
    try {
      const res = await fetch(getApiUrl('paymongo.php?action=config'))
      return await parseApiResponse(res)
    } catch (err) {
      console.error('API getPaymongoConfig error:', err)
      return { success: false, configured: false, error: err.message }
    }
  },

  async createPaymongoCheckout(checkoutData) {
    if (isSupabaseConfigured) {
      return { success: false, error: 'PayMongo checkout is not connected to the Supabase deployment.' }
    }
    try {
      const res = await fetch(getApiUrl('paymongo.php?action=create-checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutData),
      })
      return await parseApiResponse(res)
    } catch (err) {
      console.error('API createPaymongoCheckout error:', err)
      return { success: false, error: err.message }
    }
  },

  // Verify PayMongo Checkout Session
  async verifyPaymongoSession(sessionId) {
    if (isSupabaseConfigured) {
      return { success: false, error: 'PayMongo verification is not connected to the Supabase deployment.' }
    }
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 20000)
    try {
      const res = await fetch(
        getApiUrl(`paymongo.php?action=verify&session_id=${encodeURIComponent(sessionId)}`),
        { signal: controller.signal }
      )
      return await parseApiResponse(res)
    } catch (err) {
      console.error('API verifyPaymongoSession error:', err)
      return {
        success: false,
        error: err.name === 'AbortError'
          ? 'PayMongo verification timed out. Please tap Verify & Complete to try again.'
          : err.message,
      }
    } finally {
      window.clearTimeout(timeoutId)
    }
  },

  // Queue Bill
  async queueBill(billData) {
    if (isSupabaseConfigured) return stageSharedStateChange(billData)
    try {
      const res = await fetch(getApiUrl('bills.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'single', ...billData }),
      })
      return await parseApiResponse(res)
    } catch (err) {
      console.error('API queueBill error:', err)
      return { success: false, error: err.message }
    }
  },

  async deleteBill(billId, actorName, actorRole) {
    if (isSupabaseConfigured) return stageSharedStateChange({ billId, actorName, actorRole, deletedPayments: 0 })
    try {
      const res = await fetch(getApiUrl('bills.php'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId, actorName, actorRole }),
      })
      const result = await parseApiResponse(res)
      if (!res.ok && result.success) {
        return { success: false, error: `HTTP ${res.status}` }
      }
      return result
    } catch (err) {
      console.error('API deleteBill error:', err)
      return { success: false, error: err.message }
    }
  },

  async updateBillArrears(adjustment) {
    if (isSupabaseConfigured) return stageSharedStateChange(adjustment)
    try {
      const res = await fetch(getApiUrl('bills.php'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustment),
      })
      return await parseApiResponse(res)
    } catch (err) {
      console.error('API updateBillArrears error:', err)
      return { success: false, error: err.message }
    }
  },

  async submitMeterReading(reading) {
    if (isSupabaseConfigured) return stageSharedStateChange(reading)
    try {
      const res = await fetch(getApiUrl('meter_readings.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reading),
      })
      const result = await parseApiResponse(res)
      if (!res.ok && result.success) {
        return { success: false, error: `HTTP ${res.status}` }
      }
      return result
    } catch (err) {
      console.error('API submitMeterReading error:', err)
      return { success: false, error: err.message }
    }
  },

  async correctMeterReading(reading) {
    if (isSupabaseConfigured) return stageSharedStateChange(reading)
    try {
      const res = await fetch(getApiUrl('meter_readings.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'president-correction', ...reading }),
      })
      const result = await parseApiResponse(res)
      if (!res.ok && result.success) {
        return { success: false, error: `HTTP ${res.status}` }
      }
      return result
    } catch (err) {
      console.error('API correctMeterReading error:', err)
      return { success: false, error: err.message }
    }
  },

  async decideMeterReading(readingId, decision, actorName, actorRole, bill = null) {
    if (isSupabaseConfigured) return { ...(await stageSharedStateChange({ readingId, decision })), bill }
    try {
      const res = await fetch(getApiUrl('meter_readings.php'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readingId, decision, actorName, actorRole, bill }),
      })
      const result = await parseApiResponse(res)
      if (!res.ok && result.success) {
        return { success: false, error: `HTTP ${res.status}` }
      }
      return result
    } catch (err) {
      console.error('API decideMeterReading error:', err)
      return { success: false, error: err.message }
    }
  },

  // Batch Bills
  async batchBills(cycle, targetZone, billsList) {
    if (isSupabaseConfigured) return stageSharedStateChange({ cycle, targetZone, billsList })
    try {
      const res = await fetch(getApiUrl('bills.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'batch', cycle, targetZone, bills: billsList }),
      })
      return await parseApiResponse(res)
    } catch (err) {
      console.error('API batchBills error:', err)
      return { success: false, error: err.message }
    }
  },

  async runScheduledBilling() {
    try {
      const res = await fetch(getApiUrl('bills.php?action=scheduled'), { method: 'GET' })
      return await parseApiResponse(res)
    } catch (err) {
      console.error('API scheduled billing error:', err)
      return { success: false, error: err.message }
    }
  },

  // Create Maintenance Ticket
  async createTicket(ticketData) {
    if (isSupabaseConfigured) return stageSharedStateChange(ticketData)
    try {
      const res = await fetch(getApiUrl('tickets.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketData),
      })
      return await parseApiResponse(res)
    } catch (err) {
      console.error('API createTicket error:', err)
      return { success: false, error: err.message }
    }
  },

  // Update Maintenance Ticket Status
  async updateTicket(ticketData) {
    if (isSupabaseConfigured) return stageSharedStateChange(ticketData)
    try {
      const res = await fetch(getApiUrl('tickets.php'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketData),
      })
      return await parseApiResponse(res)
    } catch (err) {
      console.error('API updateTicket error:', err)
      return { success: false, error: err.message }
    }
  },

  // Add Meter Asset
  async addMeter(meterData) {
    if (isSupabaseConfigured) return stageSharedStateChange(meterData)
    try {
      const res = await fetch(getApiUrl('meters.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meterData),
      })
      return await parseApiResponse(res)
    } catch (err) {
      console.error('API addMeter error:', err)
      return { success: false, error: err.message }
    }
  },

  // Update Meter Asset
  async updateMeter(meterData) {
    if (isSupabaseConfigured) return stageSharedStateChange(meterData)
    try {
      const res = await fetch(getApiUrl('meters.php'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meterData),
      })
      return await parseApiResponse(res)
    } catch (err) {
      console.error('API updateMeter error:', err)
      return { success: false, error: err.message }
    }
  },

  // Delete Meter Asset
  async deleteMeter(serialNo, actorRole) {
    if (isSupabaseConfigured) return stageSharedStateChange({ serialNo, actorRole })
    try {
      const res = await fetch(getApiUrl('meters.php'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serialNo, actorRole }),
      })
      return await parseApiResponse(res)
    } catch (err) {
      console.error('API deleteMeter error:', err)
      return { success: false, error: err.message }
    }
  },

  // Record Audit Trail
  async recordAudit(auditData) {
    if (isSupabaseConfigured) return stageSharedStateChange(auditData)
    try {
      const res = await fetch(getApiUrl('audit.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditData),
      })
      return await parseApiResponse(res)
    } catch (err) {
      console.error('API recordAudit error:', err)
      return { success: false, error: err.message }
    }
  },

  async createNotification(notificationData) {
    if (isSupabaseConfigured) return stageSharedStateChange(notificationData)
    try {
      const res = await fetch(getApiUrl('notifications.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationData),
      })
      return await parseApiResponse(res)
    } catch (err) {
      console.error('API createNotification error:', err)
      return { success: false, error: err.message }
    }
  },

  // Auth: Login
  async login(username, password) {
    try {
      const client = requireSupabase()
      const { data, error } = await client.auth.signInWithPassword({
        email: username.trim().toLowerCase(),
        password,
      })
      if (error) throw error
      try {
        const user = await getAuthenticatedProfile(client, data.user)
        return { success: true, user }
      } catch (profileError) {
        await client.auth.signOut()
        throw profileError
      }
    } catch (err) {
      console.error('API login error:', err)
      return { success: false, error: err.message }
    }
  },

  async requestPasswordReset(email) {
    const client = requireSupabase()
    const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin,
    })
    if (error) throw error
  },

  async updatePassword(password) {
    const client = requireSupabase()
    const { error } = await client.auth.updateUser({ password })
    if (error) throw error
  },

  // Auth: Register
  async register(userData) {
    try {
      const res = await fetch(getApiUrl('auth.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', ...userData }),
      })
      return await parseApiResponse(res)
    } catch (err) {
      console.error('API register error:', err)
      return { success: false, error: err.message }
    }
  },

}

export default api
