class ApiResponse {
  constructor({
    success = true,
    message = "",
    data = null,
    statusCode = 200,
    meta = null,
  }) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.statusCode = statusCode;
    this.meta = meta;
  }

  send(res) {
    const payload = {
      success: this.success,
      message: this.message,
    };

    if (this.data !== null) payload.data = this.data;
    if (this.meta !== null) payload.meta = this.meta;

    return res.status(this.statusCode).json(payload);
  }
}

export default ApiResponse;
