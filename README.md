# AdForge AI

Website tạo chiến dịch Google Ads Brand Search bằng DeepSeek, tối ưu cho BOFU và xuất dữ liệu Tab-Delimited để sử dụng với Google Ads Editor.

## Website công khai

Sau khi GitHub Pages được bật và workflow deploy thành công, website có địa chỉ:

`https://xuyentv.github.io/ads_campaign/`

## Tính năng

- Cấu hình DeepSeek API và lưu trên trình duyệt người dùng.
- Giao diện tiếng Việt; nội dung quảng cáo đầu ra bằng tiếng Anh.
- Tạo 15 Headlines, 4 Descriptions, Display Paths và Final URL.
- Tạo 6 Sitelinks theo giới hạn ký tự Google Ads.
- Tạo 10 Callouts và 2 Structured Snippets.
- Tự gợi ý Exact Match Brand Keywords theo ý định mua BOFU.
- Có thể nhập dữ liệu Keyword Planner để lọc theo volume đã xác minh.
- Không tự tạo hoặc suy đoán volume, CPC hay nguồn dữ liệu.
- Xuất code box dạng Tab-Delimited và có nút sao chép.
- Hiển thị Audit Log kiểm tra giới hạn ký tự.

## Deploy tự động bằng GitHub Pages

Workflow tại `.github/workflows/deploy-pages.yml` tự deploy website sau mỗi lần push vào branch `main`.

### Thiết lập GitHub lần đầu

1. Mở repository trên GitHub.
2. Vào **Settings → Pages**.
3. Tại **Build and deployment → Source**, chọn **GitHub Actions**.
4. Commit và push mã nguồn lên `main`.
5. Theo dõi workflow **Deploy Website to GitHub Pages** trong tab **Actions**.

Sau khi workflow hoàn tất, website sẽ được cập nhật tự động tại cùng một URL. Không cần build hoặc tải file EXE.

## Chạy local

Có thể mở trực tiếp `index.html`, hoặc chạy một static server:

```bash
python -m http.server 8080
```

Sau đó mở `http://localhost:8080`.

## Bảo mật

DeepSeek API key được lưu trong `localStorage` của trình duyệt và gửi trực tiếp từ trình duyệt đến endpoint đã cấu hình. Không commit API key vào repository. Chỉ sử dụng website trên thiết bị và repository đáng tin cậy.

## Giới hạn dữ liệu

Website không có quyền truy cập Google Keyword Planner, SEMrush hoặc Ahrefs. Nếu không cung cấp dữ liệu nghiên cứu, hệ thống chỉ tạo keyword ideas và đánh dấu rõ là chưa xác minh volume/CPC. Nội dung nguồn từ trang sản phẩm cần được người dùng dán vào để hạn chế AI suy đoán sai USP.
