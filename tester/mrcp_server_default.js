module.exports = {
    local_ip: 'tester',
    sip_port: 8070,
    mrcp_port: 8888,
    rtp_lo_port: 10000, // Lowest UDP Port Number for RTP
    rtp_hi_port: 10256, // Highest UDP Port Number for RTP
    rtp_timeout: 5000,  // Timeout for RTP packets to be exchanged. If there is no activity for more than this, the SIP call will be terminated

    default_sr_engine: 'dtmf',
    default_ss_engine: 'dtmf',
}
