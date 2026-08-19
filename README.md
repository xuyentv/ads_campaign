# AdForge AI

Ứng dụng desktop Windows tạo nội dung Google Ads bằng DeepSeek.

## Chạy khi phát triển

Yêu cầu Node.js 20 trở lên.

```bash
npm install
npm start
```

## Tạo file EXE trên máy Windows

```bash
npm run build
```

Kết quả được lưu trong thư mục `dist/`:

- Bản cài đặt NSIS cho phép chọn thư mục cài đặt.
- Bản portable chạy trực tiếp, không cần cài đặt.

## GitHub Actions

Workflow tại `.github/workflows/build-windows.yml` chạy sau mỗi lần push lên bất kỳ branch nào.

- Push lên branch bất kỳ: tạo artifact kiểm thử, được giữ trong 30 ngày.
- Push lên `main`: tự động tạo hoặc cập nhật Release mang tag `latest`, ghi đè hai file EXE cũ bằng bản build mới nhất.
- Push tag `v*`: tạo một Release phiên bản riêng và lưu lâu dài.

Link công khai luôn trỏ tới bản mới nhất:

`https://github.com/xuyentv/ads_campaign/releases/latest`

Người dùng có thể tải bản Setup hoặc Portable tại mục **Assets** mà không cần vào tab Actions.

## Tạo GitHub Release

Mỗi commit được push lên `main` đã tự cập nhật Release `latest`. Khi cần lưu một phiên bản chính thức riêng biệt, tạo và push tag có tiền tố `v` để workflow tạo thêm Release phiên bản:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Số phiên bản trong tag nên trùng với trường `version` trong `package.json`.

## Ghi chú bảo mật

API key DeepSeek được lưu trong vùng lưu trữ cục bộ của Electron trên máy người dùng. API key không được đưa vào mã nguồn hoặc GitHub Actions. Bản build hiện chưa ký code-signing certificate, vì vậy Windows SmartScreen có thể hiển thị cảnh báo với ứng dụng mới tải xuống.
